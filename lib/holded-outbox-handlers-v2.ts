import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import {
  buildHoldedContactPayload,
  buildHoldedDocumentPayload,
  buildHoldedPaymentPayload,
  buildHoldedPurchasePayload,
  holdedConfiguration,
  holdedRequest,
} from "@/lib/holded-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type WorkerRow = { id: string; organization_id: string; channel: string; event_type: string; attempts: number; max_attempts: number; payload: Record<string, unknown>; related_case_id?: string | null };
export type WorkerOutcome = { status: "done" | "manual_review"; message: string; metadata?: Record<string, unknown> };

const text = (value: unknown) => String(value || "").trim();
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const one = (value: unknown): Record<string, unknown> | null => Array.isArray(value) ? value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null : value && typeof value === "object" ? value as Record<string, unknown> : null;
const idOf = (value: unknown) => { const row = one(value); return text(row?.id || row?._id || row?.document_id || row?.documentId || row?.contact_id || row?.contactId); };
const numberOf = (value: unknown) => { const row = one(value); return text(row?.document_number || row?.docNumber || row?.number || row?.documentNumber); };
const rowsOf = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  const row = one(value);
  for (const key of ["data", "items", "results"]) if (Array.isArray(row?.[key])) return (row[key] as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  return [];
};

function failure(result: { error?: string; detail?: string | null; status?: number }) {
  return new Error(result.detail || result.error || `holded_http_${result.status || 500}`);
}

async function ensureClientContact(organizationId: string, clientId: string, updateExisting = false) {
  const db = getSupabaseAdminClient();
  const { data: client, error } = await db.from("clients")
    .select("id,client_type,display_name,email,phone,tax_id,billing_address,country,holded_contact_id")
    .eq("organization_id", organizationId).eq("id", clientId).maybeSingle();
  if (error || !client) throw new Error(error?.message || "client_not_found");
  const existingId = text(client.holded_contact_id);
  if (existingId && !updateExisting) return existingId;
  const { endpoints } = await holdedConfiguration(organizationId);
  const body = buildHoldedContactPayload({
    name: String(client.display_name), email: client.email, phone: client.phone, taxId: client.tax_id,
    billingAddress: client.billing_address, countryCode: client.country, type: "client", isPerson: client.client_type !== "company",
  });
  const result = await holdedRequest({
    organizationId,
    method: existingId ? "PUT" : "POST",
    path: existingId ? `${endpoints.contacts}/${encodeURIComponent(existingId)}` : endpoints.contacts,
    body,
  });
  if (!result.ok) throw failure(result);
  const remoteId = existingId || idOf(result.payload);
  if (!remoteId) throw new Error("holded_contact_id_missing");
  await db.from("clients").update({ holded_contact_id: remoteId, holded_sync_status: "synced", holded_sync_error: null, holded_last_synced_at: new Date().toISOString() })
    .eq("id", client.id).eq("organization_id", organizationId);
  return remoteId;
}

async function ensureSupplierContact(organizationId: string, supplierId: string) {
  const db = getSupabaseAdminClient();
  const { data: supplier, error } = await db.from("suppliers")
    .select("id,name,email,phone,tax_id,billing_address,country,holded_contact_id")
    .eq("organization_id", organizationId).eq("id", supplierId).maybeSingle();
  if (error || !supplier) throw new Error(error?.message || "supplier_not_found");
  if (supplier.holded_contact_id) return String(supplier.holded_contact_id);
  const { endpoints } = await holdedConfiguration(organizationId);
  const result = await holdedRequest({ organizationId, method: "POST", path: endpoints.contacts, body: buildHoldedContactPayload({
    name: String(supplier.name), email: supplier.email, phone: supplier.phone, taxId: supplier.tax_id,
    billingAddress: supplier.billing_address, countryCode: supplier.country, type: "supplier", isPerson: false,
  }) });
  if (!result.ok) throw failure(result);
  const remoteId = idOf(result.payload);
  if (!remoteId) throw new Error("holded_supplier_contact_id_missing");
  await db.from("suppliers").update({ holded_contact_id: remoteId, updated_at: new Date().toISOString() })
    .eq("id", supplier.id).eq("organization_id", organizationId);
  return remoteId;
}

async function estimate(row: WorkerRow): Promise<WorkerOutcome> {
  const versionId = text(row.payload.proposal_version_id);
  if (!versionId) throw new Error("proposal_version_id_required");
  const db = getSupabaseAdminClient();
  const { data: version, error } = await db.from("proposal_versions")
    .select("id,total_sale,expires_at,proposals!proposal_versions_proposal_id_fkey(id,holded_estimate_id,case_id,cases(case_code,client_id,currency))")
    .eq("organization_id", row.organization_id).eq("id", versionId).maybeSingle();
  if (error || !version) throw new Error(error?.message || "proposal_version_not_found");
  const proposal = one(version.proposals);
  if (!proposal?.id) throw new Error("proposal_not_found");
  if (proposal.holded_estimate_id) return { status: "done", message: "Presupuesto ya sincronizado." };
  const caseRow = one(proposal.cases);
  const contactId = await ensureClientContact(row.organization_id, text(caseRow?.client_id));
  const { endpoints } = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints.estimates, body: buildHoldedDocumentPayload({
    contactId, description: `Presupuesto ${text(caseRow?.case_code)}`, amount: num(version.total_sale), currency: text(caseRow?.currency) || "EUR",
    dueDate: text(version.expires_at) || undefined, notes: `ROUTSIFY_PROPOSAL_VERSION_ID:${version.id}`,
  }) });
  if (!result.ok) throw failure(result);
  const remoteId = idOf(result.payload);
  if (remoteId) await db.from("proposals").update({ holded_estimate_id: remoteId, updated_at: new Date().toISOString() })
    .eq("id", proposal.id).eq("organization_id", row.organization_id);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Presupuesto sincronizado con Holded v2." : "Holded no devolvió identificador.", metadata: { holded_estimate_id: remoteId || null } };
}

async function billing(row: WorkerRow, module: "proformas" | "invoices"): Promise<WorkerOutcome> {
  const documentId = text(row.payload.billing_document_id);
  if (!documentId) throw new Error("billing_document_id_required");
  const db = getSupabaseAdminClient();
  const { data: document, error } = await db.from("billing_documents").select("*,cases(case_code,client_id,currency)")
    .eq("organization_id", row.organization_id).eq("id", documentId).maybeSingle();
  if (error || !document) throw new Error(error?.message || "billing_document_not_found");
  if (document.holded_document_id || document.external_document_id) return { status: "done", message: "Documento ya sincronizado." };
  const caseRow = one(document.cases);
  const contactId = await ensureClientContact(row.organization_id, text(caseRow?.client_id));
  const { endpoints } = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints[module], body: buildHoldedDocumentPayload({
    contactId, description: `${module === "proformas" ? "Proforma" : "Factura final"} ${text(caseRow?.case_code)}`,
    amount: num(document.amount), currency: text(document.currency || caseRow?.currency) || "EUR", notes: `ROUTSIFY_BILLING_DOCUMENT_ID:${document.id}`,
  }) });
  if (!result.ok) throw failure(result);
  const remoteId = idOf(result.payload);
  const documentNumber = numberOf(result.payload);
  const now = new Date().toISOString();
  await db.from("billing_documents").update({ status: remoteId ? "issued" : "ready", sync_status: remoteId ? "synced" : "manual_review", external_document_id: remoteId || null,
    holded_document_id: remoteId || null, document_number: documentNumber || null, issued_at: remoteId ? now : null, last_synced_at: remoteId ? now : null,
    sync_message: remoteId ? "Sincronizado con Holded API v2." : "Holded no devolvió identificador.", updated_at: now })
    .eq("id", document.id).eq("organization_id", row.organization_id);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Documento fiscal sincronizado con Holded v2." : "Revisión manual necesaria.", metadata: { holded_document_id: remoteId || null } };
}

async function purchase(row: WorkerRow): Promise<WorkerOutcome> {
  const purchaseId = text(row.payload.expected_purchase_id);
  if (!purchaseId) throw new Error("expected_purchase_id_required");
  const db = getSupabaseAdminClient();
  const { data: purchaseRow, error } = await db.from("expected_purchases").select("*").eq("organization_id", row.organization_id).eq("id", purchaseId).maybeSingle();
  if (error || !purchaseRow) throw new Error(error?.message || "expected_purchase_not_found");
  if (purchaseRow.holded_purchase_id) return { status: "done", message: "Compra ya sincronizada." };
  if (!purchaseRow.supplier_id) return { status: "manual_review", message: "La compra necesita un proveedor maestro antes de enviarse a Holded." };
  const contactId = await ensureSupplierContact(row.organization_id, String(purchaseRow.supplier_id));
  const { endpoints } = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints.purchases, body: buildHoldedPurchasePayload({
    contactId, contactName: text(purchaseRow.supplier_name) || undefined, description: text(purchaseRow.service) || "Servicio de viaje",
    amount: num(purchaseRow.invoice_base || purchaseRow.approved_cost || purchaseRow.expected_amount || purchaseRow.amount), currency: text(purchaseRow.currency) || "EUR",
    date: text(purchaseRow.invoice_date) || undefined, dueDate: text(purchaseRow.due_date) || undefined, number: text(purchaseRow.invoice_number) || undefined,
    notes: `ROUTSIFY_CASE_ID:${purchaseRow.case_id}; ROUTSIFY_BUDGET_LINE_ID:${purchaseRow.budget_line_id || ""}`,
  }) });
  if (!result.ok) throw failure(result);
  const remoteId = idOf(result.payload);
  const now = new Date().toISOString();
  await db.from("expected_purchases").update({ holded_purchase_id: remoteId || null, sync_status: remoteId ? "synced" : "manual_review", sync_error: remoteId ? null : "holded_id_missing", last_synced_at: now, updated_at: now })
    .eq("id", purchaseId).eq("organization_id", row.organization_id);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Compra sincronizada con Holded v2." : "Revisión manual necesaria.", metadata: { holded_purchase_id: remoteId || null } };
}

async function payment(row: WorkerRow): Promise<WorkerOutcome> {
  const caseId = text(row.payload.case_id || row.related_case_id);
  const reference = text(row.payload.reference);
  if (!caseId || !reference) throw new Error("payment_reference_required");
  const db = getSupabaseAdminClient();
  const { data: paymentRow, error } = await db.from("payments").select("*,cases(client_id,case_code)")
    .eq("organization_id", row.organization_id).eq("case_id", caseId).eq("payment_reference", reference).maybeSingle();
  if (error || !paymentRow) throw new Error(error?.message || "payment_not_found");
  if (text(one(paymentRow.payload)?.holded_payment_id)) return { status: "done", message: "Pago ya sincronizado." };
  const caseRow = one(paymentRow.cases);
  const contactId = await ensureClientContact(row.organization_id, text(caseRow?.client_id));
  const { endpoints } = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints.payments, body: buildHoldedPaymentPayload({
    contactId, amount: num(paymentRow.amount), date: text(paymentRow.received_at || paymentRow.confirmed_at) || undefined,
    description: `Cobro ${text(caseRow?.case_code)} · ${reference} · ROUTSIFY_PAYMENT_ID:${paymentRow.id}`, direction: "collection",
  }) });
  if (!result.ok) throw failure(result);
  const remoteId = idOf(result.payload);
  await db.from("payments").update({ payload: { ...(paymentRow.payload || {}), holded_payment_id: remoteId || null }, updated_at: new Date().toISOString() })
    .eq("id", paymentRow.id).eq("organization_id", row.organization_id);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Cobro sincronizado con Holded v2." : "Revisión manual necesaria.", metadata: { holded_payment_id: remoteId || null } };
}

export async function handleHoldedOutbox(row: WorkerRow): Promise<WorkerOutcome> {
  if (row.event_type === "contact.sync") return { status: "done", message: "Contacto creado o actualizado en Holded v2.", metadata: { holded_contact_id: await ensureClientContact(row.organization_id, text(row.payload.client_id), true) } };
  if (["estimate.sync", "estimate.create"].includes(row.event_type)) return estimate(row);
  if (row.event_type === "proforma.create") return billing(row, "proformas");
  if (row.event_type === "invoice.final.create") return billing(row, "invoices");
  if (row.event_type === "purchase.sync") return purchase(row);
  if (row.event_type === "payment.sync") return payment(row);
  return { status: "manual_review", message: "Evento Holded sin automatización aprobada." };
}

export async function syncHoldedPurchaseCandidates(organizationId: string) {
  const [configuration, settings] = await Promise.all([holdedConfiguration(organizationId), loadEffectiveSettings(organizationId)]);
  const minimumConfidence = Math.min(100, Math.max(0, settings.number("purchases.match.min_confidence", 70)));
  const result = await holdedRequest({ organizationId, path: `${configuration.endpoints.purchases}?limit=100`, retries: 1 });
  if (!result.ok) throw failure(result);
  const remote = rowsOf(result.payload).slice(0, 500);
  const db = getSupabaseAdminClient();
  const { data: expected, error } = await db.from("expected_purchases").select("id,supplier_name,expected_amount,amount,status,cases(case_code)")
    .eq("organization_id", organizationId).in("status", ["expected", "requested", "uploaded", "holded_candidate", "review_needed"]);
  if (error) throw new Error(error.message);
  const expectedIds = (expected || []).map((item) => String(item.id));
  const reviewed = new Set<string>();
  if (expectedIds.length) {
    const { data: rows, error: reviewedError } = await db.from("purchase_match_candidates").select("expected_purchase_id,holded_purchase_id,status")
      .eq("organization_id", organizationId).in("expected_purchase_id", expectedIds).neq("status", "candidate");
    if (reviewedError) throw new Error(reviewedError.message);
    for (const item of rows || []) reviewed.add(`${item.expected_purchase_id}:${item.holded_purchase_id}`);
  }
  let candidates = 0;
  let matchedPurchases = 0;
  let reviewNeeded = 0;
  for (const purchaseRow of expected || []) {
    const caseRow = one(purchaseRow.cases);
    const expectedAmount = num(purchaseRow.expected_amount || purchaseRow.amount);
    const supplier = text(purchaseRow.supplier_name).toLowerCase();
    const caseCode = text(caseRow?.case_code).toLowerCase();
    const matches = remote.map((item) => {
      const id = idOf(item);
      const haystack = [item.contact_name, item.contactName, item.supplier, item.description, item.notes, item.document_number, item.docNumber, item.number].map(text).join(" ").toLowerCase();
      let score = 0;
      const checks: string[] = [];
      if (caseCode && haystack.includes(caseCode)) { score += 45; checks.push("case_code"); }
      if (supplier && haystack.includes(supplier)) { score += 25; checks.push("supplier"); }
      if (Math.abs(num(item.total || item.amount || item.subtotal) - expectedAmount) <= Math.max(2, expectedAmount * 0.02)) { score += 25; checks.push("amount"); }
      return { id, item, score, checks };
    }).filter((candidate) => candidate.id && candidate.score >= minimumConfidence && !reviewed.has(`${purchaseRow.id}:${candidate.id}`))
      .sort((left, right) => right.score - left.score).slice(0, 3);
    await db.from("purchase_match_candidates").delete().eq("organization_id", organizationId).eq("expected_purchase_id", purchaseRow.id).eq("status", "candidate");
    for (const match of matches) {
      const { error: upsertError } = await db.from("purchase_match_candidates").upsert({ organization_id: organizationId, expected_purchase_id: purchaseRow.id,
        holded_purchase_id: match.id, score: match.score, checks: match.checks, payload: match.item, status: "candidate", updated_at: new Date().toISOString() },
      { onConflict: "organization_id,expected_purchase_id,holded_purchase_id" });
      if (!upsertError) candidates += 1;
    }
    if (matches[0]) {
      matchedPurchases += 1;
      await db.from("expected_purchases").update({ status: "holded_candidate", match_score: matches[0].score, match_checks: matches[0].checks, updated_at: new Date().toISOString() })
        .eq("id", purchaseRow.id).eq("organization_id", organizationId);
    } else if (purchaseRow.status === "holded_candidate") {
      reviewNeeded += 1;
      await db.from("expected_purchases").update({ status: "review_needed", match_score: null, match_checks: [],
        review_notes: `No hay candidatos de Holded que alcancen el umbral configurado del ${minimumConfidence}% o los candidatos ya fueron revisados manualmente.`, updated_at: new Date().toISOString() })
        .eq("id", purchaseRow.id).eq("organization_id", organizationId);
    }
  }
  return { remotePurchases: remote.length, expectedPurchases: expected?.length || 0, candidates, matchedPurchases, reviewNeeded, minimumConfidence };
}
