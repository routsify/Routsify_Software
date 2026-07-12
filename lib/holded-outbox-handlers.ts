import { buildHoldedContactPayload, buildHoldedDocumentPayload, holdedConfiguration, holdedRequest } from "@/lib/holded-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type WorkerRow = { id: string; organization_id: string; channel: string; event_type: string; attempts: number; max_attempts: number; payload: Record<string, unknown>; related_case_id?: string | null };
export type WorkerOutcome = { status: "done" | "manual_review"; message: string; metadata?: Record<string, unknown> };
const text = (v: unknown) => String(v || "").trim();
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const one = (v: unknown): Record<string, unknown> | null => Array.isArray(v) ? v[0] && typeof v[0] === "object" ? v[0] as Record<string, unknown> : null : v && typeof v === "object" ? v as Record<string, unknown> : null;
const idOf = (v: unknown) => { const r = one(v); return text(r?.id || r?._id || r?.documentId || r?.contactId); };
const numberOf = (v: unknown) => { const r = one(v); return text(r?.docNumber || r?.number || r?.documentNumber); };
const rowsOf = (v: unknown): Record<string, unknown>[] => { if (Array.isArray(v)) return v.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object")); const r = one(v); for (const k of ["data", "items", "results"]) if (Array.isArray(r?.[k])) return (r?.[k] as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object")); return []; };

async function ensureContact(org: string, clientId: string) {
  const db = getSupabaseAdminClient();
  const { data: client, error } = await db.from("clients").select("id,display_name,email,phone,tax_id,billing_address,holded_contact_id").eq("organization_id", org).eq("id", clientId).maybeSingle();
  if (error || !client) throw new Error(error?.message || "client_not_found");
  if (client.holded_contact_id) return String(client.holded_contact_id);
  const { endpoints } = await holdedConfiguration(org);
  const result = await holdedRequest({ organizationId: org, method: "POST", path: endpoints.contacts, body: buildHoldedContactPayload({ name: String(client.display_name), email: client.email, phone: client.phone, taxId: client.tax_id, billingAddress: client.billing_address }) });
  if (!result.ok) throw new Error(result.error); const remoteId = idOf(result.payload); if (!remoteId) throw new Error("holded_contact_id_missing");
  await db.from("clients").update({ holded_contact_id: remoteId, holded_sync_status: "synced", holded_sync_error: null, holded_last_synced_at: new Date().toISOString() }).eq("id", client.id);
  return remoteId;
}

async function estimate(row: WorkerRow): Promise<WorkerOutcome> {
  const versionId = text(row.payload.proposal_version_id); if (!versionId) throw new Error("proposal_version_id_required"); const db = getSupabaseAdminClient();
  const { data: version, error } = await db.from("proposal_versions").select("id,total_sale,proposals(case_id,cases(case_code,client_id,currency))").eq("organization_id", row.organization_id).eq("id", versionId).maybeSingle();
  if (error || !version) throw new Error(error?.message || "proposal_version_not_found"); const proposal = one(version.proposals); const c = one(proposal?.cases); const contactId = await ensureContact(row.organization_id, text(c?.client_id)); const { endpoints } = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints.estimates, body: buildHoldedDocumentPayload({ contactId, description: `Presupuesto ${text(c?.case_code)}`, amount: num(version.total_sale), currency: text(c?.currency) || "EUR", notes: `ROUTSIFY_PROPOSAL_VERSION_ID:${version.id}` }) });
  if (!result.ok) throw new Error(result.error); const remoteId = idOf(result.payload); await db.from("proposal_versions").update({ holded_document_id: remoteId || null, holded_sync_status: remoteId ? "synced" : "manual_review", holded_last_synced_at: new Date().toISOString() }).eq("id", version.id);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Presupuesto sincronizado con Holded." : "Holded no devolvió identificador.", metadata: { holded_document_id: remoteId || null } };
}

async function billing(row: WorkerRow, module: "proformas" | "invoices"): Promise<WorkerOutcome> {
  const documentId = text(row.payload.billing_document_id); if (!documentId) throw new Error("billing_document_id_required"); const db = getSupabaseAdminClient();
  const { data: document, error } = await db.from("billing_documents").select("*,cases(case_code,client_id,currency)").eq("organization_id", row.organization_id).eq("id", documentId).maybeSingle();
  if (error || !document) throw new Error(error?.message || "billing_document_not_found"); if (document.holded_document_id || document.external_document_id) return { status: "done", message: "Documento ya sincronizado." };
  const c = one(document.cases); const contactId = await ensureContact(row.organization_id, text(c?.client_id)); const { endpoints } = await holdedConfiguration(row.organization_id);
  const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints[module], body: buildHoldedDocumentPayload({ contactId, description: `${module === "proformas" ? "Proforma" : "Factura final"} ${text(c?.case_code)}`, amount: num(document.amount), currency: text(document.currency || c?.currency) || "EUR", notes: `ROUTSIFY_BILLING_DOCUMENT_ID:${document.id}` }) });
  if (!result.ok) throw new Error(result.error); const remoteId = idOf(result.payload); const documentNumber = numberOf(result.payload); const now = new Date().toISOString();
  await db.from("billing_documents").update({ status: remoteId ? "issued" : "ready", sync_status: remoteId ? "synced" : "manual_review", external_document_id: remoteId || null, holded_document_id: remoteId || null, document_number: documentNumber || null, issued_at: remoteId ? now : null, last_synced_at: remoteId ? now : null, sync_message: remoteId ? "Sincronizado con Holded." : "Holded no devolvió identificador.", updated_at: now }).eq("id", document.id);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Documento fiscal sincronizado." : "Revisión manual necesaria.", metadata: { holded_document_id: remoteId || null } };
}

async function purchase(row: WorkerRow): Promise<WorkerOutcome> {
  const purchaseId = text(row.payload.expected_purchase_id); if (!purchaseId) throw new Error("expected_purchase_id_required"); const db = getSupabaseAdminClient(); const { data: p, error } = await db.from("expected_purchases").select("*").eq("organization_id", row.organization_id).eq("id", purchaseId).maybeSingle(); if (error || !p) throw new Error(error?.message || "expected_purchase_not_found");
  const { endpoints } = await holdedConfiguration(row.organization_id); const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints.purchases, body: { desc: p.service, subtotal: num(p.invoice_base || p.expected_amount || p.amount), total: num(p.invoice_total || p.expected_amount || p.amount), notes: `ROUTSIFY_CASE_ID:${p.case_id}; ROUTSIFY_BUDGET_LINE_ID:${p.budget_line_id || ""}` } }); if (!result.ok) throw new Error(result.error);
  const remoteId = idOf(result.payload); const now = new Date().toISOString(); await db.from("expected_purchases").update({ holded_purchase_id: remoteId || null, sync_status: remoteId ? "synced" : "manual_review", sync_error: remoteId ? null : "holded_id_missing", last_synced_at: now, updated_at: now }).eq("id", purchaseId);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Compra sincronizada." : "Revisión manual necesaria.", metadata: { holded_purchase_id: remoteId || null } };
}

async function payment(row: WorkerRow): Promise<WorkerOutcome> {
  const caseId = text(row.payload.case_id || row.related_case_id); const reference = text(row.payload.reference); if (!caseId || !reference) throw new Error("payment_reference_required"); const db = getSupabaseAdminClient();
  const { data: p, error } = await db.from("payments").select("*,cases(client_id,case_code)").eq("organization_id", row.organization_id).eq("case_id", caseId).eq("payment_reference", reference).maybeSingle(); if (error || !p) throw new Error(error?.message || "payment_not_found");
  const c = one(p.cases); const contactId = await ensureContact(row.organization_id, text(c?.client_id)); const { endpoints } = await holdedConfiguration(row.organization_id); const result = await holdedRequest({ organizationId: row.organization_id, method: "POST", path: endpoints.payments, body: { contactId, amount: num(p.amount), currency: p.currency || "EUR", date: String(p.received_at || p.confirmed_at || new Date().toISOString()).slice(0, 10), desc: `Pago ${text(c?.case_code)} · ${reference}`, notes: `ROUTSIFY_PAYMENT_ID:${p.id}` } }); if (!result.ok) throw new Error(result.error);
  const remoteId = idOf(result.payload); await db.from("payments").update({ payload: { ...(p.payload || {}), holded_payment_id: remoteId || null }, updated_at: new Date().toISOString() }).eq("id", p.id);
  return { status: remoteId ? "done" : "manual_review", message: remoteId ? "Pago sincronizado." : "Revisión manual necesaria.", metadata: { holded_payment_id: remoteId || null } };
}

export async function handleHoldedOutbox(row: WorkerRow): Promise<WorkerOutcome> {
  if (row.event_type === "contact.sync") { const id = await ensureContact(row.organization_id, text(row.payload.client_id)); return { status: "done", message: "Contacto sincronizado.", metadata: { holded_contact_id: id } }; }
  if (["estimate.sync", "estimate.create"].includes(row.event_type)) return estimate(row);
  if (row.event_type === "proforma.create") return billing(row, "proformas");
  if (row.event_type === "invoice.final.create") return billing(row, "invoices");
  if (row.event_type === "purchase.sync") return purchase(row);
  if (row.event_type === "payment.sync") return payment(row);
  return { status: "manual_review", message: "Evento Holded sin automatización aprobada." };
}

export async function syncHoldedPurchaseCandidates(organizationId: string) {
  const { endpoints } = await holdedConfiguration(organizationId); const result = await holdedRequest({ organizationId, path: endpoints.purchases, retries: 1 }); if (!result.ok) throw new Error(result.error); const remote = rowsOf(result.payload).slice(0, 500); const db = getSupabaseAdminClient();
  const { data: expected, error } = await db.from("expected_purchases").select("id,supplier_name,expected_amount,amount,cases(case_code)").eq("organization_id", organizationId).not("status", "in", "(approved,not_required,cancelled)"); if (error) throw new Error(error.message); let candidates = 0;
  for (const p of expected || []) { const c = one(p.cases); const expectedAmount = num(p.expected_amount || p.amount); const supplier = text(p.supplier_name).toLowerCase(); const caseCode = text(c?.case_code).toLowerCase(); const matches = remote.map((item) => { const id = idOf(item); const haystack = [item.contactName, item.supplier, item.desc, item.description, item.notes, item.docNumber].map(text).join(" ").toLowerCase(); let score = 0; const checks: string[] = []; if (caseCode && haystack.includes(caseCode)) { score += 45; checks.push("case_code"); } if (supplier && haystack.includes(supplier)) { score += 25; checks.push("supplier"); } if (Math.abs(num(item.total || item.amount || item.subtotal) - expectedAmount) <= Math.max(2, expectedAmount * .02)) { score += 25; checks.push("amount"); } return { id, item, score, checks }; }).filter((x) => x.id && x.score >= 50).sort((a, b) => b.score - a.score).slice(0, 3);
    for (const m of matches) { const { error: upsertError } = await db.from("purchase_match_candidates").upsert({ organization_id: organizationId, expected_purchase_id: p.id, holded_purchase_id: m.id, score: m.score, checks: m.checks, payload: m.item, status: "candidate", updated_at: new Date().toISOString() }, { onConflict: "organization_id,expected_purchase_id,holded_purchase_id" }); if (!upsertError) candidates += 1; }
    if (matches[0]) await db.from("expected_purchases").update({ status: "holded_candidate", match_score: matches[0].score, match_checks: matches[0].checks, updated_at: new Date().toISOString() }).eq("id", p.id);
  }
  return { remotePurchases: remote.length, expectedPurchases: expected?.length || 0, candidates };
}
