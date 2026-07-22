import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import {
  buildHoldedContactPayload,
  buildHoldedDocumentPayload,
  buildHoldedPaymentPayload,
  holdedConfiguration,
  holdedRequest,
} from "@/lib/holded-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createHash } from "crypto";

export type WorkerRow = { id: string; organization_id: string; channel: string; event_type: string; attempts: number; max_attempts: number; payload: Record<string, unknown>; related_case_id?: string | null };
export type WorkerOutcome = { status: "done" | "manual_review"; message: string; metadata?: Record<string, unknown> };

const text = (value: unknown) => String(value || "").trim();
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const one = (value: unknown): Record<string, unknown> | null => Array.isArray(value) ? value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null : value && typeof value === "object" ? value as Record<string, unknown> : null;
const idOf = (value: unknown) => { const row = one(value); return text(row?.id || row?._id || row?.document_id || row?.documentId || row?.contact_id || row?.contactId); };
const numberOf = (value: unknown) => { const row = one(value); return text(row?.document_number || row?.docNumber || row?.number || row?.documentNumber); };
const dateOf = (value: unknown) => text(value).slice(0, 10) || null;
const hashPayload = (value: unknown) => createHash("sha256").update(JSON.stringify(value || {})).digest("hex");
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
    .select("id,name,fiscal_name,email,phone,tax_id,billing_address,country,holded_contact_id")
    .eq("organization_id", organizationId).eq("id", supplierId).maybeSingle();
  if (error || !supplier) throw new Error(error?.message || "supplier_not_found");
  if (supplier.holded_contact_id) return String(supplier.holded_contact_id);
  const { endpoints } = await holdedConfiguration(organizationId);
  const result = await holdedRequest({ organizationId, method: "POST", path: endpoints.contacts, body: buildHoldedContactPayload({
    name: String(supplier.fiscal_name || supplier.name), email: supplier.email, phone: supplier.phone, taxId: supplier.tax_id,
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
  await syncHoldedPurchaseCandidates(row.organization_id, { targetPurchaseId: purchaseId });
  return {
    status: "manual_review",
    message: "Flujo saliente desactivado: Routsify no crea facturas de proveedor en Holded. Se ha buscado la factura recibida para conciliación.",
    metadata: { expected_purchase_id: purchaseId, source: "holded_import_only" },
  };
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
  if (row.event_type === "contact.sync") {
    const clientId = text(row.payload.client_id);
    if (!clientId) throw new Error("client_id_required");
    try {
      return { status: "done", message: "Contacto creado o actualizado en Holded v2.", metadata: { holded_contact_id: await ensureClientContact(row.organization_id, clientId, true) } };
    } catch (caught) {
      if (caught instanceof Error && caught.message === "client_not_found") {
        return { status: "done", message: "Sincronización cancelada: el cliente ya no existe.", metadata: { cancelled: true, client_id: clientId } };
      }
      throw caught;
    }
  }
  if (["estimate.sync", "estimate.create"].includes(row.event_type)) return estimate(row);
  if (row.event_type === "proforma.create") return billing(row, "proformas");
  if (row.event_type === "invoice.final.create") return billing(row, "invoices");
  if (row.event_type === "purchase.sync") return purchase(row);
  if (row.event_type === "payment.sync") return payment(row);
  return { status: "manual_review", message: "Evento Holded sin automatización aprobada." };
}

function remoteContactId(item: Record<string, unknown>) {
  return text(item.contact_id || item.contactId || item.supplier_id || item.supplierId || one(item.contact)?.id || one(item.supplier)?.id);
}

function remoteContactName(item: Record<string, unknown>) {
  return text(item.contact_name || item.contactName || item.supplier_name || item.supplierName || item.supplier || one(item.contact)?.name || one(item.supplier)?.name);
}

function remoteTaxId(item: Record<string, unknown>) {
  return text(item.vat_number || item.vatNumber || item.tax_id || item.taxId || one(item.contact)?.vat_number || one(item.contact)?.tax_id);
}

function remoteTotal(item: Record<string, unknown>) {
  return num(item.total || item.total_amount || item.totalAmount || item.amount || item.subtotal || item.base_amount);
}

function remoteCurrency(item: Record<string, unknown>) {
  return text(item.currency || item.currency_code || item.currencyCode).toUpperCase() || "EUR";
}

function remoteStatus(item: Record<string, unknown>) {
  return text(item.status || item.document_status || item.docStatus || item.state) || "received";
}

function remoteUpdatedAt(item: Record<string, unknown>) {
  return text(item.updated_at || item.updatedAt || item.modified_at || item.modifiedAt || item.date) || new Date().toISOString();
}

function remoteHoldedUrl(id: string) {
  return id ? `https://app.holded.com/purchases/${encodeURIComponent(id)}` : "https://app.holded.com";
}

function includesNeedle(haystack: string, needle: string) {
  return Boolean(needle && haystack.includes(needle.toLowerCase()));
}

function daysApart(left?: string | null, right?: string | null) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / 86_400_000;
}

export async function syncHoldedPurchaseCandidates(organizationId: string, options: { targetPurchaseId?: string } = {}) {
  const [configuration, settings] = await Promise.all([holdedConfiguration(organizationId), loadEffectiveSettings(organizationId)]);
  const minimumConfidence = Math.min(100, Math.max(0, settings.number("purchases.match.min_confidence", 70)));
  const pageSize = Math.min(100, Math.max(25, settings.number("purchases.holded.page_size", 100)));
  const maxPages = Math.min(10, Math.max(1, settings.number("purchases.holded.max_pages", 5)));
  const remote: Record<string, unknown>[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = configuration.endpoints.purchases.includes("?") ? "&" : "?";
    const result = await holdedRequest({ organizationId, path: `${configuration.endpoints.purchases}${separator}limit=${pageSize}&page=${page}`, retries: 1 });
    if (!result.ok) throw failure(result);
    const rows = rowsOf(result.payload);
    remote.push(...rows);
    if (rows.length < pageSize) break;
  }
  const db = getSupabaseAdminClient();
  const expectedQuery = db.from("expected_purchases")
    .select("id,case_id,supplier_id,supplier_name,service,expected_amount,amount,currency,status,holded_purchase_id,approved_cost,invoice_total,invoice_expected_by,due_date,review_notes,budget_lines(description_public,start_date,end_date),cases(case_code,trip_start,trip_end),suppliers(id,name,fiscal_name,tax_id,holded_contact_id)")
    .eq("organization_id", organizationId)
    .in("status", ["expected", "requested", "uploaded", "holded_candidate", "review_needed", "approved"])
    .limit(5000);
  const { data: expected, error } = options.targetPurchaseId ? await expectedQuery.eq("id", options.targetPurchaseId) : await expectedQuery;
  if (error) throw new Error(error.message);
  const { data: suppliers, error: suppliersError } = await db.from("suppliers")
    .select("id,name,fiscal_name,tax_id,holded_contact_id")
    .eq("organization_id", organizationId)
    .limit(5000);
  if (suppliersError) throw new Error(suppliersError.message);
  const suppliersByHoldedId = new Map((suppliers || []).filter((item) => text(item.holded_contact_id)).map((item) => [text(item.holded_contact_id), item]));
  const expectedIds = (expected || []).map((item) => String(item.id));
  const reviewed = new Set<string>();
  if (expectedIds.length) {
    const { data: rows, error: reviewedError } = await db.from("purchase_match_candidates").select("expected_purchase_id,holded_purchase_id,status")
      .eq("organization_id", organizationId).in("expected_purchase_id", expectedIds).neq("status", "candidate");
    if (reviewedError) throw new Error(reviewedError.message);
    for (const item of rows || []) reviewed.add(`${item.expected_purchase_id}:${item.holded_purchase_id}`);
  }
  let candidates = 0;
  let importedInvoices = 0;
  let unassignedInvoices = 0;
  let matchedPurchases = 0;
  let reviewNeeded = 0;

  const normalizedRemote = remote.map((item) => {
    const id = idOf(item);
    const contactId = remoteContactId(item);
    const supplier = suppliersByHoldedId.get(contactId);
    const total = remoteTotal(item);
    const base = num(item.base_amount || item.subtotal || item.net || total);
    const tax = num(item.tax_amount || item.taxes || Math.max(total - base, 0));
    const invoiceDate = dateOf(item.date || item.invoice_date || item.invoiceDate);
    const updatedAt = remoteUpdatedAt(item);
    const hash = hashPayload(item);
    return {
      item,
      id,
      hash,
      contactId,
      contactName: remoteContactName(item),
      taxId: remoteTaxId(item),
      invoiceNumber: numberOf(item),
      invoiceDate,
      base,
      tax,
      total,
      currency: remoteCurrency(item),
      status: remoteStatus(item),
      updatedAt,
      supplierId: supplier?.id ? String(supplier.id) : null,
      supplierName: text(supplier?.name || supplier?.fiscal_name),
      haystack: [remoteContactName(item), remoteTaxId(item), numberOf(item), item.description, item.notes, item.concept, item.reference].map(text).join(" ").toLowerCase(),
    };
  }).filter((item) => item.id);

  for (const invoice of normalizedRemote) {
    const { data: existingInvoice } = await db.from("supplier_invoices")
      .select("id,expected_purchase_id,total_amount,source_payload_hash,status")
      .eq("organization_id", organizationId)
      .eq("holded_purchase_id", invoice.id)
      .maybeSingle();
    const existingHash = text(existingInvoice?.source_payload_hash);
    const changed = Boolean(existingInvoice?.id && existingHash && existingHash !== invoice.hash);
    const { error: invoiceError } = await db.from("supplier_invoices").upsert({
      organization_id: organizationId,
      expected_purchase_id: existingInvoice?.expected_purchase_id || null,
      supplier_id: invoice.supplierId,
      holded_purchase_id: invoice.id,
      holded_contact_id: invoice.contactId || null,
      invoice_number: invoice.invoiceNumber || null,
      invoice_date: invoice.invoiceDate,
      base_amount: invoice.base || null,
      tax_amount: invoice.tax || null,
      total_amount: invoice.total || null,
      currency: invoice.currency,
      sync_status: "synced",
      status: changed && existingInvoice?.status === "approved" ? "review_needed" : existingInvoice?.status || "holded_detected",
      holded_status: invoice.status,
      holded_updated_at: invoice.updatedAt,
      last_seen_at: new Date().toISOString(),
      source_payload_hash: invoice.hash,
      holded_url: remoteHoldedUrl(invoice.id),
      source_payload: invoice.item,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,holded_purchase_id" });
    if (!invoiceError) importedInvoices += 1;
    if (!existingInvoice?.expected_purchase_id) unassignedInvoices += 1;

    if (changed && existingInvoice?.expected_purchase_id) {
      await db.from("expected_purchases").update({
        status: "review_needed",
        review_notes: "La factura de Holded cambió después de estar registrada. Revisa antes de mantener el coste aprobado.",
        updated_at: new Date().toISOString(),
      }).eq("organization_id", organizationId).eq("id", existingInvoice.expected_purchase_id).eq("status", "approved");
    }
  }

  for (const purchaseRow of expected || []) {
    const caseRow = one(purchaseRow.cases);
    const supplierRow = one(purchaseRow.suppliers);
    const lineRow = one(purchaseRow.budget_lines);
    const expectedAmount = num(purchaseRow.expected_amount || purchaseRow.amount);
    const expectedCurrency = text(purchaseRow.currency).toUpperCase() || "EUR";
    const supplierName = text(purchaseRow.supplier_name || supplierRow?.name || supplierRow?.fiscal_name).toLowerCase();
    const supplierTaxId = text(supplierRow?.tax_id).toLowerCase();
    const supplierHoldedId = text(supplierRow?.holded_contact_id);
    const caseCode = text(caseRow?.case_code).toLowerCase();
    const service = text(purchaseRow.service || lineRow?.description_public).toLowerCase();
    const targetDate = dateOf(purchaseRow.invoice_expected_by || purchaseRow.due_date || lineRow?.start_date || caseRow?.trip_start);

    const matches = normalizedRemote.map((invoice) => {
      let score = 0;
      const checks: string[] = [];
      if (text(purchaseRow.holded_purchase_id) && text(purchaseRow.holded_purchase_id) === invoice.id) { score += 100; checks.push("holded_purchase_id"); }
      if (supplierHoldedId && supplierHoldedId === invoice.contactId) { score += 35; checks.push("holded_contact_id"); }
      if (supplierTaxId && invoice.taxId.toLowerCase() === supplierTaxId) { score += 30; checks.push("tax_id"); }
      if (supplierName && (includesNeedle(invoice.haystack, supplierName) || includesNeedle(supplierName, invoice.contactName))) { score += 20; checks.push("supplier_name"); }
      if (caseCode && includesNeedle(invoice.haystack, caseCode)) { score += 25; checks.push("case_code"); }
      if (service && includesNeedle(invoice.haystack, service.slice(0, 40))) { score += 15; checks.push("service"); }
      if (invoice.currency === expectedCurrency) { score += 10; checks.push("currency"); }
      if (expectedAmount > 0 && Math.abs(invoice.total - expectedAmount) <= Math.max(5, expectedAmount * 0.02)) { score += 25; checks.push("amount_2pct"); }
      else if (expectedAmount > 0 && Math.abs(invoice.total - expectedAmount) <= Math.max(15, expectedAmount * 0.05)) { score += 15; checks.push("amount_5pct"); }
      if (daysApart(invoice.invoiceDate, targetDate) <= 14) { score += 10; checks.push("date_near"); }
      return { id: invoice.id, invoice, score: Math.min(score, 100), checks };
    }).filter((candidate) => candidate.id && candidate.score >= minimumConfidence && !reviewed.has(`${purchaseRow.id}:${candidate.id}`))
      .sort((left, right) => right.score - left.score).slice(0, 3);

    await db.from("purchase_match_candidates").delete().eq("organization_id", organizationId).eq("expected_purchase_id", purchaseRow.id).eq("status", "candidate");
    for (const match of matches) {
      const { error: upsertError } = await db.from("purchase_match_candidates").upsert({
        organization_id: organizationId,
        expected_purchase_id: purchaseRow.id,
        holded_purchase_id: match.id,
        score: match.score,
        checks: match.checks,
        payload: match.invoice.item,
        status: "candidate",
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,expected_purchase_id,holded_purchase_id" });
      if (!upsertError) candidates += 1;
    }

    const best = matches[0];
    if (best && matches.filter((item) => item.score === best.score).length === 1) {
      matchedPurchases += 1;
      await db.from("supplier_invoices").update({ expected_purchase_id: purchaseRow.id, status: "holded_candidate", updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId).eq("holded_purchase_id", best.id).is("expected_purchase_id", null);
      await db.from("expected_purchases").update({
        status: purchaseRow.status === "approved" ? "review_needed" : "holded_candidate",
        holded_purchase_id: best.id,
        invoice_number: best.invoice.invoiceNumber || null,
        invoice_date: best.invoice.invoiceDate,
        invoice_base: best.invoice.base || null,
        invoice_tax: best.invoice.tax || null,
        invoice_total: best.invoice.total || null,
        match_score: best.score,
        match_checks: best.checks,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        review_notes: purchaseRow.status === "approved" ? "Holded ha detectado una factura nueva o modificada sobre una compra ya aprobada. Revisión necesaria." : purchaseRow.review_notes,
      })
        .eq("id", purchaseRow.id).eq("organization_id", organizationId);
    } else if (purchaseRow.status === "holded_candidate") {
      reviewNeeded += 1;
      await db.from("expected_purchases").update({ status: "review_needed", match_score: null, match_checks: [],
        review_notes: `No hay candidatos de Holded que alcancen el umbral configurado del ${minimumConfidence}% o los candidatos ya fueron revisados manualmente.`, updated_at: new Date().toISOString() })
        .eq("id", purchaseRow.id).eq("organization_id", organizationId);
    }
  }
  return { remotePurchases: normalizedRemote.length, importedInvoices, unassignedInvoices, expectedPurchases: expected?.length || 0, candidates, matchedPurchases, reviewNeeded, minimumConfidence };
}
