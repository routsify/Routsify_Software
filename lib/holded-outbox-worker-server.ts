import { buildHoldedContactPayload, buildHoldedDocumentPayload, holdedConfiguration, holdedRequest } from "@/lib/holded-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type OutboxRow = {
  id: string;
  organization_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts?: number;
  max_attempts?: number;
  related_case_id?: string | null;
};

type HoldedObject = Record<string, unknown>;

function text(value: unknown) {
  return String(value || "").trim();
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function externalId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const row = payload as HoldedObject;
  return text(row.id || row._id || row.documentId || row.contactId || row.paymentId);
}

async function ensureHoldedContact(organizationId: string, clientId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id,display_name,billing_name,email,billing_email,phone,tax_id,billing_address,holded_contact_id")
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !client) throw new Error(error?.message || "client_not_found");

  const config = await holdedConfiguration(organizationId);
  const body = buildHoldedContactPayload({
    name: text(client.billing_name || client.display_name) || "Cliente Routsify",
    email: text(client.billing_email || client.email) || null,
    phone: text(client.phone) || null,
    taxId: text(client.tax_id) || null,
    billingAddress: client.billing_address,
  });
  const existingId = text(client.holded_contact_id);
  const result = await holdedRequest({
    organizationId,
    method: existingId ? "PUT" : "POST",
    path: existingId ? `${config.endpoints.contacts}/${encodeURIComponent(existingId)}` : config.endpoints.contacts,
    body,
  });
  if (!result.ok) throw new Error(result.error);
  const holdedId = existingId || externalId(result.payload);
  if (!holdedId) throw new Error("holded_contact_id_missing");
  await supabase.from("clients").update({ holded_contact_id: holdedId, holded_sync_status: "synced", holded_sync_error: null, holded_last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", clientId).eq("organization_id", organizationId);
  return { holdedId, client };
}

async function syncContact(row: OutboxRow) {
  const clientId = text(row.payload.client_id);
  if (!clientId) throw new Error("client_id_required");
  const result = await ensureHoldedContact(row.organization_id, clientId);
  return { externalId: result.holdedId, message: "Contacto sincronizado con Holded." };
}

async function syncEstimate(row: OutboxRow) {
  const supabase = getSupabaseAdminClient();
  const versionId = text(row.payload.proposal_version_id);
  if (!versionId) throw new Error("proposal_version_id_required");
  const { data: version, error } = await supabase.from("proposal_versions")
    .select("id,total_sale,proposal_id,proposals(id,case_id,holded_estimate_id,cases(id,case_code,client_id,currency))")
    .eq("id", versionId).eq("organization_id", row.organization_id).maybeSingle();
  if (error || !version) throw new Error(error?.message || "proposal_version_not_found");
  const proposal = Array.isArray(version.proposals) ? version.proposals[0] : version.proposals;
  const caseRow = proposal && (Array.isArray(proposal.cases) ? proposal.cases[0] : proposal.cases);
  if (!proposal || !caseRow?.client_id) throw new Error("proposal_case_client_missing");
  const contact = await ensureHoldedContact(row.organization_id, String(caseRow.client_id));
  const config = await holdedConfiguration(row.organization_id);
  const existingId = text(proposal.holded_estimate_id);
  const result = await holdedRequest({
    organizationId: row.organization_id,
    method: existingId ? "PUT" : "POST",
    path: existingId ? `${config.endpoints.estimates}/${encodeURIComponent(existingId)}` : config.endpoints.estimates,
    body: buildHoldedDocumentPayload({ contactId: contact.holdedId, description: `Presupuesto viaje ${text(caseRow.case_code)}`, amount: numberValue(version.total_sale), currency: text(caseRow.currency) || "EUR", notes: `ROUTSIFY_PROPOSAL_VERSION_ID:${versionId}` }),
  });
  if (!result.ok) throw new Error(result.error);
  const holdedId = existingId || externalId(result.payload);
  if (!holdedId) throw new Error("holded_estimate_id_missing");
  await supabase.from("proposals").update({ holded_estimate_id: holdedId, updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("organization_id", row.organization_id);
  return { externalId: holdedId, message: "Presupuesto sincronizado con Holded." };
}

async function syncBillingDocument(row: OutboxRow, kind: "proforma" | "invoice") {
  const supabase = getSupabaseAdminClient();
  const documentId = text(row.payload.billing_document_id);
  if (!documentId) throw new Error("billing_document_id_required");
  const { data: document, error } = await supabase.from("billing_documents")
    .select("id,case_id,client_id,amount,currency,external_document_id,holded_document_id,document_number,cases(case_code)")
    .eq("id", documentId).eq("organization_id", row.organization_id).maybeSingle();
  if (error || !document) throw new Error(error?.message || "billing_document_not_found");
  if (!document.client_id) throw new Error("billing_client_required");
  const contact = await ensureHoldedContact(row.organization_id, String(document.client_id));
  const config = await holdedConfiguration(row.organization_id);
  const existingId = text(document.external_document_id || document.holded_document_id);
  const caseRow = Array.isArray(document.cases) ? document.cases[0] : document.cases;
  const endpoint = kind === "proforma" ? config.endpoints.proformas : config.endpoints.invoices;
  const result = await holdedRequest({
    organizationId: row.organization_id,
    method: existingId ? "PUT" : "POST",
    path: existingId ? `${endpoint}/${encodeURIComponent(existingId)}` : endpoint,
    body: buildHoldedDocumentPayload({ contactId: contact.holdedId, description: kind === "proforma" ? `Proforma viaje ${text(caseRow?.case_code)}` : `Factura final viaje ${text(caseRow?.case_code)}`, amount: numberValue(document.amount), currency: text(document.currency) || "EUR", notes: `ROUTSIFY_BILLING_DOCUMENT_ID:${document.id}` }),
  });
  if (!result.ok) throw new Error(result.error);
  const holdedId = existingId || externalId(result.payload);
  if (!holdedId) throw new Error("holded_document_id_missing");
  const payload = result.payload && typeof result.payload === "object" ? result.payload as HoldedObject : {};
  await supabase.from("billing_documents").update({ holded_document_id: holdedId, external_document_id: holdedId, document_number: text(payload.docNumber || payload.number) || document.document_number, status: "issued", sync_status: "synced", sync_message: null, issued_at: new Date().toISOString(), last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", document.id).eq("organization_id", row.organization_id);
  if (kind === "invoice") await supabase.from("cases").update({ fiscal_resolution_status: "resolved", fiscal_resolution_at: new Date().toISOString(), billing_status: "invoiced", updated_at: new Date().toISOString() }).eq("id", document.case_id).eq("organization_id", row.organization_id);
  return { externalId: holdedId, message: kind === "proforma" ? "Proforma emitida en Holded." : "Factura final emitida en Holded." };
}

async function syncPurchase(row: OutboxRow) {
  const supabase = getSupabaseAdminClient();
  const purchaseId = text(row.payload.expected_purchase_id);
  if (!purchaseId) throw new Error("expected_purchase_id_required");
  const { data: purchase, error } = await supabase.from("expected_purchases").select("*,suppliers(holded_contact_id)").eq("id", purchaseId).eq("organization_id", row.organization_id).maybeSingle();
  if (error || !purchase) throw new Error(error?.message || "expected_purchase_not_found");
  const config = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: config.endpoints.purchases, body: { contactId: purchase.suppliers?.holded_contact_id || undefined, desc: purchase.service || purchase.supplier_name || "Compra proveedor", date: purchase.invoice_date || undefined, subtotal: numberValue(purchase.invoice_base || purchase.expected_amount || purchase.amount), total: numberValue(purchase.invoice_total || purchase.expected_amount || purchase.amount), notes: `ROUTSIFY_EXPECTED_PURCHASE_ID:${purchase.id};ROUTSIFY_CASE_ID:${purchase.case_id || ""}` } });
  if (!result.ok) throw new Error(result.error);
  const holdedId = externalId(result.payload);
  if (!holdedId) throw new Error("holded_purchase_id_missing");
  await supabase.from("expected_purchases").update({ holded_purchase_id: holdedId, sync_status: "synced", sync_error: null, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", purchase.id).eq("organization_id", row.organization_id);
  return { externalId: holdedId, message: "Compra sincronizada con Holded." };
}

async function syncPayment(row: OutboxRow) {
  const config = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: config.endpoints.payments, body: { amount: numberValue(row.payload.amount), date: text(row.payload.received_at) || new Date().toISOString(), description: `Pago Routsify ${text(row.payload.reference)}`, notes: `ROUTSIFY_CASE_ID:${text(row.payload.case_id)};ROUTSIFY_PAYMENT_REFERENCE:${text(row.payload.reference)}` } });
  if (!result.ok) throw new Error(result.error);
  return { externalId: externalId(result.payload), message: "Pago sincronizado con Holded." };
}

async function processRow(row: OutboxRow) {
  if (row.event_type === "contact.sync") return syncContact(row);
  if (row.event_type === "estimate.sync") return syncEstimate(row);
  if (row.event_type === "proforma.create") return syncBillingDocument(row, "proforma");
  if (row.event_type === "invoice.final.create") return syncBillingDocument(row, "invoice");
  if (row.event_type === "purchase.sync") return syncPurchase(row);
  if (row.event_type === "payment.sync") return syncPayment(row);
  throw new Error("unsupported_holded_event");
}

export async function processHoldedOutboxBatch(limit = 30) {
  const supabase = getSupabaseAdminClient();
  const supported = ["contact.sync", "estimate.sync", "proforma.create", "invoice.final.create", "purchase.sync", "payment.sync"];
  const { data: rows, error } = await supabase.from("integration_outbox").select("id,organization_id,event_type,payload,attempts,max_attempts,related_case_id").eq("channel", "holded").in("event_type", supported).in("status", ["pending", "failed"]).or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`).order("created_at").limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw new Error(error.message);
  const details: Array<Record<string, unknown>> = [];
  for (const row of (rows || []) as OutboxRow[]) {
    const attempts = Number(row.attempts || 0) + 1;
    await supabase.from("integration_outbox").update({ status: "processing", attempts, last_attempt_at: new Date().toISOString(), locked_at: new Date().toISOString(), locked_by: "holded-specialized-worker" }).eq("id", row.id).in("status", ["pending", "failed"]);
    try {
      const outcome = await processRow(row);
      const now = new Date().toISOString();
      await supabase.from("integration_outbox").update({ status: "done", sync_status: "synced", processed_at: now, last_synced_at: now, last_error: null, next_action: null, next_attempt_at: null, locked_at: null, locked_by: null }).eq("id", row.id);
      details.push({ id: row.id, ok: true, ...outcome });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "holded_sync_failed";
      const exhausted = attempts >= Number(row.max_attempts || 3);
      await supabase.from("integration_outbox").update({ status: exhausted ? "manual_review" : "failed", sync_status: "sync_error", last_error: message, next_action: exhausted ? "Revisar manualmente la integración con Holded." : "Reintento automático con backoff.", next_attempt_at: exhausted ? null : new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString(), locked_at: null, locked_by: null }).eq("id", row.id);
      details.push({ id: row.id, ok: false, error: message, exhausted });
    }
  }
  return { checked: rows?.length || 0, processed: details.filter((item) => item.ok).length, failed: details.filter((item) => !item.ok).length, details };
}

export async function syncHoldedPurchaseCandidates(organizationId: string) {
  const config = await holdedConfiguration(organizationId);
  const result = await holdedRequest({ organizationId, path: `${config.endpoints.purchases}${config.endpoints.purchases.includes("?") ? "&" : "?"}limit=100`, retries: 1 });
  if (!result.ok) throw new Error(result.error);
  const payload = Array.isArray(result.payload) ? result.payload : result.payload && typeof result.payload === "object" && Array.isArray((result.payload as HoldedObject).data) ? (result.payload as HoldedObject).data as unknown[] : [];
  return { imported: payload.length, payload };
}
