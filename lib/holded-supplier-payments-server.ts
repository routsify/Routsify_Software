import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { holdedConfiguration, holdedRequest } from "@/lib/holded-server";
import { recordIntegrationRun } from "@/lib/integration-health-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createHash } from "crypto";

type JsonRow = Record<string, unknown>;

export type SyncHoldedSupplierPaymentsOptions = {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  cursor?: string | null;
  limit?: number | null;
  targetPurchaseId?: string | null;
  triggerSource?: string | null;
  recordRun?: boolean;
};

export type SyncHoldedSupplierPaymentsResult = {
  ok: boolean;
  paymentsRead: number;
  new: number;
  updated: number;
  assigned: number;
  reviewNeeded: number;
  ignored: number;
  reverted: number;
  errorCount: number;
  errors: Array<{ holdedPaymentId: string; error: string }>;
  startDate?: string;
  endDate?: string;
  summary: string;
  error?: string;
};

type NormalizedHoldedPayment = {
  id: string;
  documentType: string;
  documentId: string | null;
  contactId: string | null;
  contactTaxId: string | null;
  amount: number;
  rawAmount: number;
  currency: string;
  paidAt: string;
  description: string | null;
  bankId: string | null;
  reference: string | null;
  direction: string | null;
  statusText: string;
  payloadHash: string;
  redactedPayload: JsonRow;
};

type SupplierRow = { id: string; name: string | null; fiscal_name: string | null; tax_id: string | null; holded_contact_id: string | null };
type SupplierInvoiceRow = { id: string; expected_purchase_id: string | null; holded_purchase_id: string | null };
type ExistingSupplierPaymentEvent = { holded_payment_id: string; source_payload_hash: string | null; status: string | null };
type ExpectedPurchaseRow = {
  id: string;
  case_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  service: string | null;
  expected_amount: number | string | null;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  active: boolean | null;
  payment_reference: string | null;
  due_date: string | null;
  invoice_date: string | null;
  invoice_total: number | string | null;
  approved_cost: number | string | null;
  holded_purchase_id: string | null;
  suppliers?: SupplierRow | SupplierRow[] | null;
};

type MatchResult = {
  purchaseId: string | null;
  status: "matched" | "review_needed" | "reversed" | "ignored" | "unassigned";
  allocationSource: "reference" | "auto" | "import";
  matchScore: number | null;
  reason: string;
};

const CUSTOMER_DOCUMENT_TYPES = new Set(["invoice", "salesreceipt", "estimate", "proforma", "salesinvoice", "receipt", "ticket"]);
const SUPPLIER_DOCUMENT_TYPES = new Set(["purchase", "purchaseinvoice", "supplierinvoice"]);
const REVERSAL_DOCUMENT_TYPES = new Set(["purchaserefund", "refund", "purchase_refund", "creditnote", "purchasecreditnote"]);

function text(value: unknown) { return String(value || "").trim(); }
function lower(value: unknown) { return text(value).toLowerCase(); }
function numeric(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
function firstText(...values: unknown[]) {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}
function one(value: unknown): JsonRow | null {
  if (Array.isArray(value)) return value.find((item): item is JsonRow => Boolean(item && typeof item === "object" && !Array.isArray(item))) || null;
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRow : null;
}
function rowsOf(value: unknown): JsonRow[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRow => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  const row = one(value);
  if (!row) return [];
  for (const key of ["data", "items", "results", "payments"]) {
    if (Array.isArray(row[key])) return (row[key] as unknown[]).filter((item): item is JsonRow => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  }
  return [];
}
function nextCursorOf(value: unknown) {
  const row = one(value);
  if (!row) return null;
  const pagination = one(row.pagination) || one(row.meta) || one(row.page_info) || {};
  return text(row.next_cursor || row.nextCursor || row.cursor_next || row.next || pagination.next_cursor || pagination.nextCursor || pagination.next) || null;
}
function dateText(value: unknown) {
  const raw = text(value);
  if (!raw) return new Date().toISOString();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    const ms = n > 10_000_000_000 ? n : n * 1000;
    const date = new Date(ms);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}
function dateParam(value: Date | string) { return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10); }
function currency(value: unknown) {
  const candidate = text(value).toUpperCase();
  return /^[A-Z]{3}$/.test(candidate) ? candidate : "EUR";
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as JsonRow).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as JsonRow)[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}
function hashPayload(value: unknown) { return createHash("sha256").update(stableJson(value)).digest("hex"); }
function redactPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPayload);
  if (!value || typeof value !== "object") return value;
  const output: JsonRow = {};
  for (const [key, raw] of Object.entries(value as JsonRow)) {
    output[key] = /(api.?key|authorization|token|secret|password|iban|swift|bic|account.?number|bank.?account|card|pan|cvv)/i.test(key) ? "[redacted]" : redactPayload(raw);
  }
  return output;
}
function contactIdOf(payment: JsonRow) {
  const contact = one(payment.contact) || one(payment.supplier) || one(payment.client);
  return firstText(payment.contact_id, payment.contactId, payment.supplier_id, payment.supplierId, payment.client_id, payment.clientId, contact?.id, contact?._id);
}
function contactTaxIdOf(payment: JsonRow) {
  const contact = one(payment.contact) || one(payment.supplier) || one(payment.client);
  return firstText(payment.vat_number, payment.vatNumber, payment.tax_id, payment.taxId, contact?.vat_number, contact?.vatNumber, contact?.tax_id, contact?.taxId);
}
function documentOf(payment: JsonRow) { return one(payment.document) || one(payment.doc) || one(payment.invoice) || one(payment.purchase) || {}; }

export function normalizeHoldedPaymentPayload(payment: JsonRow): NormalizedHoldedPayment | null {
  const document = documentOf(payment);
  const redactedPayload = redactPayload(payment) as JsonRow;
  const id = firstText(payment.id, payment._id, payment.payment_id, payment.paymentId);
  if (!id) return null;
  const rawAmount = numeric(firstText(payment.amount, payment.total, payment.total_amount, payment.totalAmount, payment.value));
  const documentType = lower(payment.document_type || payment.documentType || payment.doc_type || payment.docType || document.type || document.document_type || document.documentType);
  return {
    id,
    documentType,
    documentId: firstText(payment.document_id, payment.documentId, payment.doc_id, payment.docId, document.id, document._id) || null,
    contactId: contactIdOf(payment) || null,
    contactTaxId: contactTaxIdOf(payment) || null,
    amount: Math.abs(rawAmount),
    rawAmount,
    currency: currency(firstText(payment.currency, payment.currency_code, payment.currencyCode, document.currency)),
    paidAt: dateText(firstText(payment.paid_at, payment.paidAt, payment.date, payment.payment_date, payment.paymentDate, payment.created_at, payment.createdAt)),
    description: firstText(payment.description, payment.notes, payment.concept, payment.memo, document.description, document.number) || null,
    bankId: firstText(payment.bank_id, payment.bankId, payment.bank, one(payment.bank)?.id, one(payment.account)?.id) || null,
    reference: firstText(payment.payment_reference, payment.paymentReference, payment.reference, payment.ref, payment.concept, payment.description) || null,
    direction: lower(payment.direction || payment.type || payment.payment_type || payment.paymentType) || null,
    statusText: lower(payment.status || payment.state || payment.kind),
    payloadHash: hashPayload(redactedPayload),
    redactedPayload,
  };
}

function supplierOf(purchase: ExpectedPurchaseRow): SupplierRow | null {
  if (Array.isArray(purchase.suppliers)) return purchase.suppliers[0] || null;
  return purchase.suppliers || null;
}
function expectedAmount(purchase: ExpectedPurchaseRow) {
  return Math.max(numeric(purchase.expected_amount), numeric(purchase.amount), numeric(purchase.invoice_total), numeric(purchase.approved_cost));
}
function activePurchase(purchase: ExpectedPurchaseRow) { return purchase.active !== false && !["cancelled", "not_required"].includes(String(purchase.status || "")); }
function sameDateNear(left?: string | null, right?: string | null) {
  if (!left || !right) return true;
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) <= 7 * 86_400_000;
}
function amountCompatible(payment: NormalizedHoldedPayment, purchase: ExpectedPurchaseRow) {
  const limit = expectedAmount(purchase);
  return limit <= 0 || payment.amount <= limit + 0.01 || Math.abs(payment.amount - limit) <= 0.01;
}
function exactTax(left?: string | null, right?: string | null) {
  const clean = (value?: string | null) => text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return Boolean(clean(left) && clean(left) === clean(right));
}
function appendQuery(path: string, params: Record<string, string | number | null | undefined>) {
  const entries = Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!entries.length) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&")}`;
}

function matchPayment(payment: NormalizedHoldedPayment, purchases: ExpectedPurchaseRow[], suppliersByHoldedId: Map<string, SupplierRow>, invoicesByHoldedPurchaseId: Map<string, SupplierInvoiceRow>, targetPurchaseId?: string | null): MatchResult {
  if (REVERSAL_DOCUMENT_TYPES.has(payment.documentType) || payment.rawAmount < 0 || payment.amount <= 0 || payment.statusText.includes("refund") || payment.statusText.includes("revers")) return { purchaseId: null, status: "reversed", allocationSource: "import", matchScore: null, reason: "reversal_or_correction" };
  if (CUSTOMER_DOCUMENT_TYPES.has(payment.documentType) || payment.direction === "collection") return { purchaseId: null, status: "ignored", allocationSource: "import", matchScore: null, reason: "customer_collection" };
  const eligible = purchases.filter((purchase) => activePurchase(purchase) && (!targetPurchaseId || purchase.id === targetPurchaseId));

  if (SUPPLIER_DOCUMENT_TYPES.has(payment.documentType) && payment.documentId) {
    const invoice = invoicesByHoldedPurchaseId.get(payment.documentId);
    const purchase = invoice?.expected_purchase_id ? eligible.find((item) => item.id === invoice.expected_purchase_id) : null;
    if (purchase && amountCompatible(payment, purchase) && currency(purchase.currency) === payment.currency) return { purchaseId: purchase.id, status: "matched", allocationSource: "import", matchScore: 100, reason: "holded_purchase_id_matches_supplier_invoice" };
  }

  if (payment.reference) {
    const exact = eligible.filter((purchase) => text(purchase.payment_reference).toUpperCase() === text(payment.reference).toUpperCase() && currency(purchase.currency) === payment.currency);
    if (exact.length === 1 && amountCompatible(payment, exact[0])) return { purchaseId: exact[0].id, status: "matched", allocationSource: "reference", matchScore: 98, reason: "payment_reference_exact" };
    if (exact.length > 1) return { purchaseId: null, status: "review_needed", allocationSource: "reference", matchScore: null, reason: "multiple_reference_matches" };
  }

  if (payment.contactId && suppliersByHoldedId.has(payment.contactId)) {
    const supplier = suppliersByHoldedId.get(payment.contactId);
    const candidates = eligible.filter((purchase) => purchase.supplier_id === supplier?.id && currency(purchase.currency) === payment.currency && amountCompatible(payment, purchase));
    if (candidates.length === 1) return { purchaseId: candidates[0].id, status: "matched", allocationSource: "auto", matchScore: 88, reason: "holded_contact_currency_amount_unique" };
    if (candidates.length > 1) return { purchaseId: null, status: "review_needed", allocationSource: "auto", matchScore: null, reason: "multiple_supplier_amount_matches" };
  }

  if (payment.contactTaxId) {
    const candidates = eligible.filter((purchase) => {
      const supplier = supplierOf(purchase);
      return exactTax(payment.contactTaxId, supplier?.tax_id) && currency(purchase.currency) === payment.currency && amountCompatible(payment, purchase) && sameDateNear(payment.paidAt, purchase.due_date || purchase.invoice_date);
    });
    if (candidates.length === 1) return { purchaseId: candidates[0].id, status: "matched", allocationSource: "auto", matchScore: 80, reason: "tax_id_amount_date_unique" };
    if (candidates.length > 1) return { purchaseId: null, status: "review_needed", allocationSource: "auto", matchScore: null, reason: "multiple_tax_id_matches" };
  }

  if (!payment.documentType && payment.contactId && suppliersByHoldedId.has(payment.contactId)) return { purchaseId: null, status: "review_needed", allocationSource: "auto", matchScore: null, reason: "supplier_payment_without_safe_purchase_match" };
  if (SUPPLIER_DOCUMENT_TYPES.has(payment.documentType)) return { purchaseId: null, status: "review_needed", allocationSource: "import", matchScore: null, reason: "supplier_document_without_purchase_match" };
  return { purchaseId: null, status: "ignored", allocationSource: "import", matchScore: null, reason: "not_supplier_payment" };
}

async function importEvent(organizationId: string, payment: NormalizedHoldedPayment, match: MatchResult, actorId: string) {
  const db = getSupabaseAdminClient() as any;
  const { data, error } = await db.rpc("import_and_allocate_supplier_payment", {
    target_organization_id: organizationId,
    target_expected_purchase_id: match.purchaseId,
    payment_event: {
      holded_payment_id: payment.id,
      holded_contact_id: payment.contactId,
      amount: payment.amount,
      paid_at: payment.paidAt,
      currency: payment.currency,
      description: payment.description,
      bank_id: payment.bankId,
      payment_reference: payment.reference,
      source: "holded",
      source_payload_hash: payment.payloadHash,
      source_payload: { ...payment.redactedPayload, _routsify_classification: { document_type: payment.documentType, document_id: payment.documentId, reason: match.reason } },
      status: match.status,
      match_score: match.matchScore,
    },
    allocation_source: match.allocationSource,
    actor_id: actorId,
  });
  if (error) throw new Error(error.message);
  return data as { ok?: boolean; status?: string; allocated?: boolean; review_reason?: string };
}

export async function syncHoldedSupplierPayments(organizationId: string, options: SyncHoldedSupplierPaymentsOptions = {}): Promise<SyncHoldedSupplierPaymentsResult> {
  const startedAt = new Date().toISOString();
  const db = getSupabaseAdminClient() as any;
  const metrics = { paymentsRead: 0, new: 0, updated: 0, assigned: 0, reviewNeeded: 0, ignored: 0, reverted: 0, errorCount: 0 };

  try {
    const [configuration, settings] = await Promise.all([holdedConfiguration(organizationId), loadEffectiveSettings(organizationId)]);
    const { data: lastRun } = await db.from("integration_runs").select("started_at,finished_at").eq("organization_id", organizationId).eq("integration", "holded_supplier_payments").eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle();
    const initialBackfillDays = Math.min(90, Math.max(1, settings.number("purchases.holded_payments.initial_backfill_days", 30)));
    const overlapMinutes = Math.min(120, Math.max(1, settings.number("purchases.holded_payments.overlap_minutes", 10)));
    const limit = Math.min(250, Math.max(1, Number(options.limit || settings.number("purchases.holded_payments.page_size", 100))));
    const maxPages = Math.min(100, Math.max(1, settings.number("purchases.holded_payments.max_pages", 25)));
    const lastCompletedAt = lastRun?.finished_at || lastRun?.started_at;
    const startDate = options.startDate ? new Date(options.startDate) : lastCompletedAt ? new Date(Date.parse(lastCompletedAt) - overlapMinutes * 60_000) : new Date(Date.now() - initialBackfillDays * 86_400_000);
    const endDate = options.endDate ? new Date(options.endDate) : new Date();

    const payments: NormalizedHoldedPayment[] = [];
    let cursor = text(options.cursor);
    for (let page = 0; page < maxPages; page += 1) {
      const result = await holdedRequest({ organizationId, path: appendQuery(configuration.endpoints.payments, { start_date: dateParam(startDate), end_date: dateParam(endDate), cursor: cursor || null, limit }), retries: 1 });
      if (!result.ok) throw new Error(result.detail || result.error || `holded_http_${result.status}`);
      const rows = rowsOf(result.payload);
      metrics.paymentsRead += rows.length;
      for (const row of rows) {
        const normalized = normalizeHoldedPaymentPayload(row);
        if (normalized) payments.push(normalized);
      }
      const nextCursor = nextCursorOf(result.payload);
      if (!nextCursor || nextCursor === cursor || rows.length < limit) break;
      cursor = nextCursor;
    }

    const [{ data: purchases, error: purchasesError }, { data: suppliers, error: suppliersError }, { data: invoices, error: invoicesError }, { data: existingEvents, error: eventsError }] = await Promise.all([
      db.from("expected_purchases").select("id,case_id,supplier_id,supplier_name,service,expected_amount,amount,currency,status,active,payment_reference,due_date,invoice_date,invoice_total,approved_cost,holded_purchase_id,suppliers:suppliers!expected_purchases_supplier_id_fkey(id,name,fiscal_name,tax_id,holded_contact_id)").eq("organization_id", organizationId).limit(5000),
      db.from("suppliers").select("id,name,fiscal_name,tax_id,holded_contact_id").eq("organization_id", organizationId).limit(5000),
      db.from("supplier_invoices").select("id,expected_purchase_id,holded_purchase_id").eq("organization_id", organizationId).not("holded_purchase_id", "is", null).limit(5000),
      db.from("supplier_payment_events").select("holded_payment_id,source_payload_hash,status").eq("organization_id", organizationId).eq("source", "holded").not("holded_payment_id", "is", null).limit(10000),
    ]);
    if (purchasesError) throw new Error(purchasesError.message);
    if (suppliersError) throw new Error(suppliersError.message);
    if (invoicesError) throw new Error(invoicesError.message);
    if (eventsError) throw new Error(eventsError.message);

    const expectedPurchases = (purchases || []) as ExpectedPurchaseRow[];
    const supplierRows = (suppliers || []) as SupplierRow[];
    const invoiceRows = (invoices || []) as SupplierInvoiceRow[];
    const eventRows = (existingEvents || []) as ExistingSupplierPaymentEvent[];
    const suppliersByHoldedId = new Map<string, SupplierRow>(supplierRows.filter((item) => text(item.holded_contact_id)).map((item) => [text(item.holded_contact_id), item]));
    const invoicesByHoldedPurchaseId = new Map<string, SupplierInvoiceRow>(invoiceRows.filter((item) => text(item.holded_purchase_id)).map((item) => [text(item.holded_purchase_id), item]));
    const existingByHoldedId = new Map<string, ExistingSupplierPaymentEvent>(eventRows.map((item) => [text(item.holded_payment_id), item]));

    const errors: Array<{ holdedPaymentId: string; error: string }> = [];
    for (const payment of payments) {
      const match = matchPayment(payment, expectedPurchases, suppliersByHoldedId, invoicesByHoldedPurchaseId, options.targetPurchaseId);
      if (match.status === "ignored" && ["customer_collection", "not_supplier_payment"].includes(match.reason)) {
        metrics.ignored += 1;
        continue;
      }
      const existing = existingByHoldedId.get(payment.id);
      try {
        const result = await importEvent(organizationId, payment, match, "internal");
        if (match.status === "reversed") metrics.reverted += 1;
        if (result?.allocated || result?.status === "matched") metrics.assigned += 1;
        if (result?.status === "review_needed" || match.status === "review_needed") metrics.reviewNeeded += 1;
        if (!existing) metrics.new += 1;
        else if (existing.source_payload_hash !== payment.payloadHash || existing.status !== result?.status) metrics.updated += 1;
      } catch (error) {
        metrics.errorCount += 1;
        errors.push({ holdedPaymentId: payment.id, error: error instanceof Error ? error.message : "supplier_payment_import_failed" });
      }
    }

    const finishedAt = new Date().toISOString();
    const summary = `${metrics.paymentsRead} pagos leídos, ${metrics.new} nuevos, ${metrics.updated} actualizados, ${metrics.assigned} asignados, ${metrics.reviewNeeded} en revisión, ${metrics.ignored} ignorados, ${metrics.reverted} revertidos, ${metrics.errorCount} errores.`;
    if (options.recordRun !== false) {
      await recordIntegrationRun({ organizationId, integration: "holded_supplier_payments", kind: "cron", status: metrics.errorCount ? "failed" : "done", startedAt, finishedAt, triggerSource: options.triggerSource || "manual", summary, lastError: errors[0]?.error || null, metadata: { ...metrics, errors, startDate: startDate.toISOString(), endDate: endDate.toISOString(), cursorMode: lastCompletedAt && !options.startDate ? "last_success_with_overlap" : "explicit_or_initial_backfill", overlapMinutes, limit } });
    }
    return { ok: metrics.errorCount === 0, ...metrics, errors, startDate: startDate.toISOString(), endDate: endDate.toISOString(), summary };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "holded_supplier_payment_sync_failed";
    if (options.recordRun !== false) await recordIntegrationRun({ organizationId, integration: "holded_supplier_payments", kind: "cron", status: "failed", startedAt, finishedAt, triggerSource: options.triggerSource || "manual", summary: "Error importando pagos a proveedor desde Holded.", lastError: message, metadata: metrics }).catch(() => null);
    return { ok: false, ...metrics, errors: [], error: message, summary: "Error importando pagos a proveedor desde Holded." };
  }
}
