import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function numeric(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }

export async function ensureProformaForCase(input: { organizationId: string; caseId: string; actorId: string; paymentReference: string }) {
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error } = await supabase.from("cases").select("id,case_code,client_id,accepted_value,currency,clients(id,display_name,email,phone,tax_id,billing_address,holded_contact_id)").eq("id", input.caseId).eq("organization_id", input.organizationId).maybeSingle();
  if (error || !caseRow) throw new Error(error?.message || "case_not_found");
  const amount = numeric(caseRow.accepted_value);
  if (amount <= 0) throw new Error("accepted_value_required");
  const idempotencyKey = `proforma:${input.organizationId}:${input.caseId}`;
  const now = new Date().toISOString();
  const { data: document, error: documentError } = await supabase.from("billing_documents").upsert({
    organization_id: input.organizationId,
    case_id: input.caseId,
    client_id: caseRow.client_id,
    document_type: "proforma",
    type: "proforma",
    trigger: "payment_confirmed",
    trigger_name: "payment_confirmed",
    amount,
    tax_amount: 0,
    currency: String(caseRow.currency || "EUR"),
    status: "ready",
    sync_status: "pending",
    idempotency_key: idempotencyKey,
    sync_message: "Proforma por la totalidad del viaje pendiente de sincronizar con Holded.",
    notes: `Creada al confirmar el pago ${input.paymentReference}.`,
    updated_at: now,
  }, { onConflict: "organization_id,idempotency_key" }).select("*").single();
  if (documentError) throw new Error(documentError.message);
  const client = Array.isArray(caseRow.clients) ? caseRow.clients[0] : caseRow.clients;
  const outbox = await enqueueOutboxEvent({
    organizationId: input.organizationId,
    channel: "holded",
    eventType: "proforma.create",
    relatedCaseId: input.caseId,
    idempotencyKey,
    payload: { billing_document_id: document.id, case_id: input.caseId, case_code: caseRow.case_code, client_id: caseRow.client_id, contact: client || null, amount, currency: caseRow.currency || "EUR", description: `Viaje ${caseRow.case_code}` },
    risk: "low",
    businessRule: "Emitir una proforma por el total del viaje al recibir el primer pago confirmado.",
    nextAction: "Crear proforma en Holded.",
  });
  await supabase.from("timeline_events").insert({ organization_id: input.organizationId, case_id: input.caseId, event_type: "fiscal.proforma_queued", title: "Proforma total preparada para Holded", payload: { billing_document_id: document.id, amount, outbox_id: outbox.ok ? outbox.data?.id : null }, created_by: input.actorId });
  return { document, outbox };
}

export async function finalInvoiceEligibility(organizationId: string, caseId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error } = await supabase.from("cases").select("id,case_code,trip_end,accepted_value,currency,client_id,status").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (error || !caseRow) return { eligible: false as const, blockers: [error?.message || "case_not_found"], caseRow: null };
  const blockers: string[] = [];
  if (!caseRow.trip_end) blockers.push("trip_end_missing");
  else {
    const eligibleDate = new Date(`${caseRow.trip_end}T00:00:00Z`); eligibleDate.setUTCDate(eligibleDate.getUTCDate() + 5);
    if (Date.now() < eligibleDate.getTime()) blockers.push("five_day_wait_not_completed");
  }
  const { data: purchases, error: purchaseError } = await supabase.from("expected_purchases").select("id,status,required,active").eq("organization_id", organizationId).eq("case_id", caseId);
  if (purchaseError) blockers.push("supplier_purchase_check_failed");
  else if ((purchases || []).some((item) => item.active !== false && item.required !== false && !["approved", "not_required", "cancelled"].includes(String(item.status)))) blockers.push("supplier_invoices_pending");
  const { data: payments } = await supabase.from("payments").select("amount,status").eq("organization_id", organizationId).eq("case_id", caseId);
  const paid = (payments || []).filter((item) => item.status === "confirmed").reduce((sum, item) => sum + numeric(item.amount), 0);
  if (paid < numeric(caseRow.accepted_value)) blockers.push("payment_incomplete");
  const { data: contract } = await supabase.from("contracts").select("id").eq("organization_id", organizationId).eq("case_id", caseId).eq("status", "signed").limit(1).maybeSingle();
  if (!contract) blockers.push("contract_not_signed");
  return { eligible: blockers.length === 0, blockers, caseRow, paid } as const;
}

export async function queueFinalInvoice(input: { organizationId: string; caseId: string; actorId?: string }) {
  const check = await finalInvoiceEligibility(input.organizationId, input.caseId);
  if (!check.eligible || !check.caseRow) return { ok: false as const, blockers: check.blockers };
  const supabase = getSupabaseAdminClient();
  const idempotencyKey = `final-invoice:${input.organizationId}:${input.caseId}`;
  const { data: existing } = await supabase.from("billing_documents").select("*").eq("organization_id", input.organizationId).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing?.sync_status === "synced") return { ok: true as const, duplicate: true, document: existing };
  const amount = numeric(check.caseRow.accepted_value);
  const { data: document, error } = await supabase.from("billing_documents").upsert({
    organization_id: input.organizationId,
    case_id: input.caseId,
    client_id: check.caseRow.client_id,
    document_type: "final_invoice",
    type: "final_invoice",
    trigger: "trip_plus_5_and_supplier_invoices_complete",
    trigger_name: "trip_plus_5_and_supplier_invoices_complete",
    amount,
    tax_amount: 0,
    currency: String(check.caseRow.currency || "EUR"),
    status: "ready",
    sync_status: "pending",
    idempotency_key: idempotencyKey,
    sync_message: "Factura final pendiente de sincronizar con Holded.",
    notes: "Generada tras finalizar el viaje, esperar cinco días y aprobar todas las facturas de proveedor.",
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,idempotency_key" }).select("*").single();
  if (error) throw new Error(error.message);
  const outbox = await enqueueOutboxEvent({ organizationId: input.organizationId, channel: "holded", eventType: "invoice.final.create", relatedCaseId: input.caseId, idempotencyKey, payload: { billing_document_id: document.id, case_id: input.caseId, case_code: check.caseRow.case_code, client_id: check.caseRow.client_id, amount, currency: check.caseRow.currency || "EUR", description: `Factura final viaje ${check.caseRow.case_code}` }, risk: "low", businessRule: "Emitir factura final cinco días después del viaje y solo cuando todas las compras de proveedor estén resueltas.", nextAction: "Crear factura final en Holded." });
  await supabase.from("timeline_events").insert({ organization_id: input.organizationId, case_id: input.caseId, event_type: "fiscal.final_invoice_queued", title: "Factura final preparada para Holded", payload: { billing_document_id: document.id, outbox_id: outbox.ok ? outbox.data?.id : null }, created_by: input.actorId || null });
  return { ok: true as const, duplicate: false, document, outbox };
}

export async function queueEligibleFinalInvoices() {
  const supabase = getSupabaseAdminClient();
  const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - 5);
  const { data: cases, error } = await supabase.from("cases").select("id,organization_id,case_code").lte("trip_end", cutoff.toISOString().slice(0, 10)).neq("status", "closed");
  if (error) throw new Error(error.message);
  const results = [];
  for (const item of cases || []) results.push({ caseId: item.id, caseCode: item.case_code, ...(await queueFinalInvoice({ organizationId: item.organization_id, caseId: item.id })) });
  return results;
}
