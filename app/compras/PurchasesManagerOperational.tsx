"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";
import { RowActionMenu } from "@/components/RowActionMenu";

type CaseOption = { id: string; case_code: string; title?: string | null; currency?: string | null; clients?: { display_name?: string | null } | null };
type Supplier = { id: string; name: string; fiscal_name?: string | null; category?: string | null; tax_id?: string | null; holded_contact_id?: string | null; invoice_portal_url?: string | null; invoice_retrieval_method?: string | null; invoice_grace_days?: number | string | null; invoice_retrieval_notes?: string | null; active?: boolean };
type SupplierInvoice = { id: string; status?: string | null; holded_purchase_id?: string | null; holded_status?: string | null; holded_updated_at?: string | null; last_seen_at?: string | null; holded_url?: string | null; invoice_number?: string | null; invoice_date?: string | null; base_amount?: number | string | null; tax_amount?: number | string | null; total?: number | string | null; total_amount?: number | string | null; currency?: string | null; created_at?: string | null; updated_at?: string | null };
type SupplierPaymentEvent = { id: string; amount?: number | string | null; currency?: string | null; paid_at?: string | null; description?: string | null; payment_reference?: string | null; source?: string | null; status?: string | null; holded_payment_id?: string | null; holded_contact_id?: string | null; created_at?: string | null; updated_at?: string | null };
type SupplierPaymentAllocation = { id: string; allocated_amount?: number | string | null; currency?: string | null; allocation_source?: string | null; match_score?: number | string | null; created_at?: string | null; supplier_payment_events?: SupplierPaymentEvent | SupplierPaymentEvent[] | null };
type SyncRun = { id: string; status?: string | null; started_at?: string | null; finished_at?: string | null; summary?: string | null; last_error?: string | null };
type BudgetLine = { id?: string; service_type_code?: string | null; description_public?: string | null; description_internal?: string | null; destination_segment?: string | null; start_date?: string | null; end_date?: string | null; cost_budget?: number | string | null; cost_real?: number | string | null; cost_real_source?: string | null; sale_price?: number | string | null; supplier_id?: string | null; supplier_name?: string | null };
type Purchase = {
  id: string;
  case_id?: string | null;
  proposal_version_id?: string | null;
  budget_line_id?: string | null;
  supplier_id?: string | null;
  holded_purchase_id?: string | null;
  cases?: { id?: string | null; case_code?: string | null; title?: string | null; currency?: string | null } | null;
  suppliers?: Supplier | null;
  budget_lines?: BudgetLine | null;
  supplier_name?: string | null;
  service?: string | null;
  status?: string | null;
  amount?: number | string | null;
  expected_amount?: number | string | null;
  approved_cost?: number | string | null;
  invoice_total?: number | string | null;
  payment_reference?: string | null;
  invoice_expected_by?: string | null;
  match_score?: number | string | null;
  match_checks?: unknown;
  currency?: string | null;
  due_date?: string | null;
  review_notes?: string | null;
  supplier_invoices?: SupplierInvoice[];
  supplier_payment_allocations?: SupplierPaymentAllocation[];
};
type Draft = { case_id: string; supplier_id: string; service: string; amount: string; currency: string; status: string; review_notes: string };
type PaymentDraft = { amount: string; paid_at: string; method: string; reference: string };

const statusOptions = [
  ["expected", "Pendiente de recibir"], ["requested", "Solicitada al proveedor"], ["uploaded", "Detectada en Holded"],
  ["holded_candidate", "Coincidencia encontrada"], ["matched", "Recibida y vinculada"],
  ["review_needed", "Requiere revisión"], ["approved", "Completada"],
  ["not_required", "No necesaria"], ["cancelled", "Cancelada"],
] as const;
const viewTabs = [
  { id: "pending", label: "Pendientes de recibir" },
  { id: "review", label: "Recibidas por revisar" },
  { id: "issues", label: "Con incidencia" },
  { id: "done", label: "Completadas" },
] as const;
type ViewTab = typeof viewTabs[number]["id"];
const emptyDraft: Draft = { case_id: "", supplier_id: "", service: "", amount: "", currency: "EUR", status: "expected", review_notes: "" };

function one<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] as T | undefined) || null : value && typeof value === "object" ? value as T : null; }
function normalize(input: unknown): Purchase {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || crypto.randomUUID()),
    case_id: row.case_id ? String(row.case_id) : null,
    proposal_version_id: row.proposal_version_id ? String(row.proposal_version_id) : null,
    budget_line_id: row.budget_line_id ? String(row.budget_line_id) : null,
    supplier_id: row.supplier_id ? String(row.supplier_id) : null,
    holded_purchase_id: row.holded_purchase_id ? String(row.holded_purchase_id) : null,
    cases: one<Purchase["cases"]>(row.cases),
    suppliers: one<Supplier>(row.suppliers),
    budget_lines: one<BudgetLine>(row.budget_lines),
    supplier_name: row.supplier_name ? String(row.supplier_name) : null,
    service: row.service ? String(row.service) : null,
    status: row.status ? String(row.status) : "expected",
    amount: (typeof row.amount === "number" || typeof row.amount === "string") ? row.amount : row.expected_amount as number | string | null,
    expected_amount: row.expected_amount as number | string | null,
    approved_cost: row.approved_cost as number | string | null,
    invoice_total: row.invoice_total as number | string | null,
    payment_reference: row.payment_reference ? String(row.payment_reference) : null,
    invoice_expected_by: row.invoice_expected_by ? String(row.invoice_expected_by) : null,
    match_score: row.match_score as number | string | null,
    match_checks: row.match_checks,
    currency: row.currency ? String(row.currency) : String(one<Purchase["cases"]>(row.cases)?.currency || "EUR"),
    due_date: row.due_date ? String(row.due_date) : null,
    review_notes: row.review_notes ? String(row.review_notes) : null,
    supplier_invoices: Array.isArray(row.supplier_invoices) ? row.supplier_invoices as SupplierInvoice[] : [],
    supplier_payment_allocations: Array.isArray(row.supplier_payment_allocations) ? row.supplier_payment_allocations as SupplierPaymentAllocation[] : [],
  };
}
function normalizeCase(input: unknown): CaseOption { const row = input as Record<string, unknown>; const rawClient = Array.isArray(row.clients) ? row.clients[0] : row.clients; return { id: String(row.id || ""), case_code: String(row.case_code || "Expediente"), title: row.title ? String(row.title) : null, currency: row.currency ? String(row.currency) : "EUR", clients: rawClient && typeof rawClient === "object" ? rawClient as CaseOption["clients"] : null }; }
function normalizeSupplier(input: unknown): Supplier { const row = input as Record<string, unknown>; return { id: String(row.id || ""), name: String(row.name || "Proveedor"), fiscal_name: row.fiscal_name ? String(row.fiscal_name) : null, category: row.category ? String(row.category) : null, tax_id: row.tax_id ? String(row.tax_id) : null, holded_contact_id: row.holded_contact_id ? String(row.holded_contact_id) : null, invoice_portal_url: row.invoice_portal_url ? String(row.invoice_portal_url) : null, invoice_retrieval_method: row.invoice_retrieval_method ? String(row.invoice_retrieval_method) : "email", invoice_grace_days: row.invoice_grace_days as number | string | null, invoice_retrieval_notes: row.invoice_retrieval_notes ? String(row.invoice_retrieval_notes) : null, active: row.active !== false }; }
function statusLabel(value?: string | null) { return statusOptions.find(([key]) => key === value)?.[1] || value || "Pendiente"; }
function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0)); }
function dateRange(line?: BudgetLine | null) { if (!line?.start_date && !line?.end_date) return "—"; return `${line.start_date || "—"} → ${line.end_date || "—"}`; }
function invoiceTotal(item: Purchase) { const invoices = [...(item.supplier_invoices || [])].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))); return Number(item.invoice_total || invoices[0]?.total_amount || invoices[0]?.total || 0); }
function latestInvoice(item: Purchase) { return [...(item.supplier_invoices || [])].sort((a, b) => String(b.last_seen_at || b.updated_at || b.created_at || "").localeCompare(String(a.last_seen_at || a.updated_at || a.created_at || "")))[0] || null; }
function expectedCost(item: Purchase) { return Number(item.expected_amount || item.budget_lines?.cost_budget || item.amount || 0); }
function realCost(item: Purchase) { return Number(item.approved_cost || item.budget_lines?.cost_real || 0); }
function paymentEvent(allocation: SupplierPaymentAllocation) { return one<SupplierPaymentEvent>(allocation.supplier_payment_events); }
function paidAmount(item: Purchase) { return (item.supplier_payment_allocations || []).filter((allocation) => !["reversed", "ignored"].includes(String(paymentEvent(allocation)?.status || ""))).reduce((sum, allocation) => sum + Number(allocation.allocated_amount || 0), 0); }
function remainingToPay(item: Purchase) { return Math.max(0, Math.max(expectedCost(item), invoiceTotal(item), realCost(item)) - paidAmount(item)); }
function paidWithoutInvoice(item: Purchase) { return Math.max(0, paidAmount(item) - invoiceTotal(item)); }
function provisionalCost(item: Purchase) { return Math.max(expectedCost(item), paidAmount(item), invoiceTotal(item), realCost(item)); }
function finalCost(item: Purchase) { return ["approved", "not_required"].includes(String(item.status)) ? (realCost(item) || invoiceTotal(item)) : 0; }
function economicStatus(item: Purchase) { const expected = Math.max(expectedCost(item), invoiceTotal(item), realCost(item)); const paid = paidAmount(item); if (paid <= 0) return "Sin pagar"; if (paid + 0.01 < expected) return "Parcialmente pagada"; if (paid > expected + 0.01) return "Pago excedido"; return "Pagada"; }
function documentStatus(item: Purchase) { if (String(item.status) === "approved") return "Factura conciliada"; if (["review_needed", "holded_candidate", "matched", "uploaded"].includes(String(item.status))) return "Revisión necesaria"; if (latestInvoice(item)) return "Factura detectada"; if (paidAmount(item) > 0) return "Factura pendiente"; return "Factura pendiente"; }
function defaultPaymentDraft(item: Purchase | null): PaymentDraft { const today = new Date().toISOString().slice(0, 10); if (!item) return { amount: "", paid_at: today, method: "transferencia", reference: "" }; const remaining = remainingToPay(item) || expectedCost(item); return { amount: remaining ? String(Number(remaining.toFixed(2))) : "", paid_at: today, method: "transferencia", reference: item.payment_reference || "" }; }
function defaultApprovalCost(item: Purchase | null) { return item ? String(invoiceTotal(item) || expectedCost(item) || "") : ""; }
function viewFor(item: Purchase): ViewTab {
  const status = String(item.status || "expected");
  if (["approved", "not_required", "cancelled"].includes(status)) return "done";
  if (status === "review_needed") return "issues";
  if (["uploaded", "holded_candidate", "matched"].includes(status) || latestInvoice(item)) return "review";
  return "pending";
}
function dateLabel(value?: string | null) { return value ? new Intl.DateTimeFormat("es-ES").format(new Date(value)) : "—"; }
function timeAgo(value?: string | null) { if (!value) return "Nunca"; const diff = Date.now() - new Date(value).getTime(); if (!Number.isFinite(diff)) return "Nunca"; const minutes = Math.max(0, Math.round(diff / 60_000)); if (minutes < 60) return `Hace ${minutes} min`; const hours = Math.round(minutes / 60); if (hours < 48) return `Hace ${hours} h`; return dateLabel(value); }
function daysFromToday(value?: string | null) { if (!value) return null; const diff = new Date(value).getTime() - Date.now(); if (!Number.isFinite(diff)) return null; return Math.ceil(diff / 86_400_000); }
function breakdown(items: Purchase[], selector: (item: Purchase) => number) {
  const totals = new Map<string, number>();
  for (const item of items) { const currency = String(item.currency || item.cases?.currency || "EUR"); totals.set(currency, (totals.get(currency) || 0) + selector(item)); }
  return [...totals.entries()].filter(([, value]) => value !== 0).sort(([left], [right]) => left.localeCompare(right)).map(([currency, value]) => money(value, currency)).join(" · ") || money(0, "EUR");
}
export function PurchasesManagerOperational({ initialPurchases = [], initialCases = [], initialSuppliers = [], initialSyncRun = null, initialLastSuccessfulSyncAt = null, generatedAt = "", initialCaseId = "", initialSupplierId = "" }: { initialPurchases?: unknown[]; initialCases?: unknown[]; initialSuppliers?: unknown[]; initialSyncRun?: SyncRun | null; initialLastSuccessfulSyncAt?: string | null; generatedAt?: string; initialCaseId?: string; initialSupplierId?: string }) {
  const canManage = usePermission("purchases.manage");
  const normalizedItems = initialPurchases.map(normalize);
  const normalizedCases = initialCases.map(normalizeCase).filter((item) => item.id);
  const [items, setItems] = useState<Purchase[]>(normalizedItems);
  const [cases] = useState<CaseOption[]>(normalizedCases);
  const [suppliers] = useState<Supplier[]>(() => initialSuppliers.map(normalizeSupplier).filter((item) => item.id));
  const initialSelected = normalizedItems.find((item) => item.case_id === initialCaseId || item.supplier_id === initialSupplierId) || normalizedItems[0] || null;
  const initialCase = normalizedCases.find((item) => item.id === initialCaseId) || null;
  const [selectedId, setSelectedId] = useState<string | null>(() => initialSelected?.id || null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [activeView, setActiveView] = useState<ViewTab>("pending");
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierId || "Todos");
  const [showCreate, setShowCreate] = useState(Boolean(initialCaseId && !normalizedItems.some((item) => item.case_id === initialCaseId)));
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft, case_id: initialCase?.id || "", currency: initialCase?.currency || "EUR", supplier_id: suppliers.some((item) => item.id === initialSupplierId && item.active !== false) ? initialSupplierId : "" }));
  const [approvalCost, setApprovalCost] = useState(() => defaultApprovalCost(initialSelected));
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(() => defaultPaymentDraft(initialSelected));
  const [notRequiredReason, setNotRequiredReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.suppliers?.name, item.supplier_name, item.service, item.cases?.case_code, item.currency, item.budget_lines?.description_public, item.budget_lines?.destination_segment].filter(Boolean).join(" ").toLowerCase();
    return viewFor(item) === activeView && (filter === "Todos" || item.status === filter) && (supplierFilter === "Todos" || item.supplier_id === supplierFilter) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [items, query, filter, activeView, supplierFilter]);
  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0] || null;
  const countsByView = viewTabs.reduce((acc, tab) => ({ ...acc, [tab.id]: items.filter((item) => viewFor(item) === tab.id).length }), {} as Record<ViewTab, number>);
  const forecastTotal = breakdown(items, expectedCost);
  const approvedTotal = breakdown(items, realCost);
  const paidTotal = breakdown(items, paidAmount);
  const paidWithoutInvoiceTotal = breakdown(items, paidWithoutInvoice);
  const pendingPaymentTotal = breakdown(items, remainingToPay);
  const overdueCount = items.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status)) && (daysFromToday(item.invoice_expected_by || item.due_date || item.budget_lines?.start_date) ?? 1) < 0).length;
  const attentionCount = countsByView.review + countsByView.issues + overdueCount;
  const lastSyncAt = initialSyncRun?.finished_at || initialSyncRun?.started_at || null;
  const lastSuccessfulSyncAt = initialLastSuccessfulSyncAt || (initialSyncRun?.status === "done" ? lastSyncAt : null);
  const renderedAt = Date.parse(generatedAt);
  const syncAgeHours = lastSuccessfulSyncAt ? (renderedAt - new Date(lastSuccessfulSyncAt).getTime()) / 3_600_000 : null;
  const syncHasFailed = initialSyncRun?.status === "failed";
  const syncIsStale = syncAgeHours === null || !Number.isFinite(syncAgeHours) || syncAgeHours > 26;
  const syncAlert = syncHasFailed
    ? `La última sincronización Holded falló: ${initialSyncRun?.last_error || "revisar integration_runs"}.`
    : syncIsStale
      ? `No hay una sincronización correcta de Holded en las últimas 26 horas. Último éxito: ${lastSuccessfulSyncAt ? timeAgo(lastSuccessfulSyncAt) : "nunca"}.`
      : null;
  const pendingBySupplier = useMemo(() => {
    const groups = new Map<string, { supplierId?: string | null; name: string; portalUrl?: string | null; method?: string | null; count: number; total: number; oldestDays: number | null; items: Purchase[] }>();
    for (const item of items.filter((entry) => viewFor(entry) === "pending")) {
      const key = item.supplier_id || item.supplier_name || item.suppliers?.name || "no-supplier";
      const current = groups.get(key) || { supplierId: item.supplier_id, name: item.suppliers?.name || item.supplier_name || "Proveedor sin vincular", portalUrl: item.suppliers?.invoice_portal_url || null, method: item.suppliers?.invoice_retrieval_method || null, count: 0, total: 0, oldestDays: null, items: [] };
      const days = daysFromToday(item.invoice_expected_by || item.due_date || item.budget_lines?.start_date || null);
      current.count += 1;
      current.total += expectedCost(item);
      current.oldestDays = days === null ? current.oldestDays : current.oldestDays === null ? days : Math.min(current.oldestDays, days);
      current.items.push(item);
      groups.set(key, current);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 6);
  }, [items]);

  function changeDraft(key: keyof Draft, value: string) {
    setDraft((current) => {
      if (key !== "case_id") return { ...current, [key]: value };
      const selectedCase = cases.find((item) => item.id === value);
      return { ...current, case_id: value, currency: selectedCase?.currency || current.currency || "EUR" };
    });
  }
  function selectPurchase(item: Purchase) { setSelectedId(item.id); setApprovalCost(defaultApprovalCost(item)); setPaymentDraft(defaultPaymentDraft(item)); setNotRequiredReason(""); }
  function replaceItem(input: unknown) { const updated = normalize(input); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); setSelectedId(updated.id); setApprovalCost(defaultApprovalCost(updated)); setPaymentDraft(defaultPaymentDraft(updated)); }

  async function createPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const amount = Number(draft.amount || 0);
    if (!draft.case_id) return setMessage("Selecciona un expediente.");
    if (!draft.supplier_id) return setMessage("Selecciona un proveedor del directorio.");
    if (!Number.isFinite(amount) || amount < 0) return setMessage("El importe no es válido.");
    setSaving(true); setMessage(null);
    const response = await fetch("/api/routsify/expected-purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, service: draft.service.trim() || null, amount, currency: draft.currency.trim().toUpperCase() || "EUR", review_notes: draft.review_notes.trim() || null }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo crear la compra."));
    const created = normalize(result.data); setItems((current) => [created, ...current]); selectPurchase(created); setDraft({ ...emptyDraft, currency: cases.find((item) => item.id === draft.case_id)?.currency || "EUR" }); setShowCreate(false); setMessage("Compra creada y vinculada al proveedor maestro.");
  }

  async function updateStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    setSavingId(id); setMessage(null);
    const response = await fetch(`/api/routsify/expected-purchases/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, ...extra }) });
    const result = await response.json().catch(() => null); setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar la compra."));
    replaceItem(result.data); setMessage(status === "approved" ? "Compra aprobada. El coste real y el margen del presupuesto se han recalculado." : "Estado actualizado.");
  }

  async function deletePurchase(item: Purchase) {
    if (!canManage || savingId) return;
    const label = item.service || item.budget_lines?.description_public || item.suppliers?.name || item.supplier_name || "esta compra";
    if (!window.confirm(`¿Eliminar definitivamente “${label}”?\n\nSolo se permitirá si es una compra manual todavía sin factura, conciliación ni sincronización con Holded. Esta acción no se puede deshacer.`)) return;
    setSavingId(item.id); setMessage(null);
    const response = await fetch(`/api/routsify/expected-purchases/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(result?.error === "purchase_has_protected_history" ? "No se puede eliminar porque la compra procede de un presupuesto o ya conserva factura, conciliación o historial en Holded." : String(result?.error || "No se pudo eliminar la compra."));
    const remaining = items.filter((current) => current.id !== item.id);
    setItems(remaining);
    if (selectedId === item.id) { const next = remaining[0] || null; setSelectedId(next?.id || null); setApprovalCost(defaultApprovalCost(next)); }
    setMessage(`Compra “${label}” eliminada correctamente.`);
  }

  async function syncHoldedNow(purchaseId?: string) {
    setSavingId(purchaseId || "holded-sync"); setMessage(null);
    const response = await fetch("/api/routsify/expected-purchases/sync-holded", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(purchaseId ? { purchaseId } : {}) });
    const result = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo sincronizar con Holded."));
    window.location.reload();
  }

  async function registerSupplierPayment() {
    if (!selected) return;
    const amount = Number(paymentDraft.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return setMessage("El importe pagado no es válido.");
    setSavingId(`payment-${selected.id}`); setMessage(null);
    const response = await fetch(`/api/routsify/expected-purchases/${encodeURIComponent(selected.id)}/supplier-payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount,
        paid_at: paymentDraft.paid_at,
        method: paymentDraft.method,
        reference: paymentDraft.reference,
      }),
    });
    const result = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo registrar el pago proveedor."));
    replaceItem(result.data);
    setMessage("Pago a proveedor registrado. El cash flow ya refleja la salida de caja; la factura sigue pendiente hasta Holded.");
  }

  const selectedExpected = selected ? expectedCost(selected) : 0;
  const selectedPaid = selected ? paidAmount(selected) : 0;
  const selectedReal = selected ? realCost(selected) : 0;
  const selectedInvoice = selected ? invoiceTotal(selected) : 0;
  const selectedProvisional = selected ? provisionalCost(selected) : 0;
  const selectedFinal = selected ? finalCost(selected) : 0;
  const selectedDeviation = (selectedFinal || selectedInvoice || selectedPaid) ? (selectedFinal || selectedInvoice || selectedPaid) - selectedExpected : 0;
  const selectedSale = Number(selected?.budget_lines?.sale_price || 0);
  const selectedProfit = selectedSale ? selectedSale - (selectedProvisional || selectedExpected) : 0;
  const selectedFinalProfit = selectedSale && selectedFinal ? selectedSale - selectedFinal : 0;
  const selectedMargin = selectedSale ? (selectedProfit / selectedSale) * 100 : 0;
  const selectedFinalMargin = selectedSale && selectedFinal ? (selectedFinalProfit / selectedSale) * 100 : 0;

  return <div className="clients-page">
    <section className="client-kpis"><div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Previsto proveedor</strong><b>{countsByView.pending}</b><small>{forecastTotal}</small></span></div><div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Pagado proveedor</strong><b>{paidTotal}</b><small>Salida de caja real</small></span></div><div className="kpi-card"><span className="kpi-icon">F</span><span className="kpi-copy"><strong>Pagado sin factura</strong><b>{paidWithoutInvoiceTotal}</b><small>Coste provisional</small></span></div><div className="kpi-card"><span className="kpi-icon">↘</span><span className="kpi-copy"><strong>Pendiente pagar</strong><b>{pendingPaymentTotal}</b><small>Compromiso futuro</small></span></div></section>
    <section className="client-kpis"><div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Atención operativa</strong><b>{attentionCount}</b><small>{overdueCount} vencida{overdueCount === 1 ? "" : "s"}</small></span></div><div className="kpi-card"><span className="kpi-icon">H</span><span className="kpi-copy"><strong>Holded por revisar</strong><b>{countsByView.review}</b><small>Facturas detectadas</small></span></div><div className="kpi-card"><span className="kpi-icon">✓</span><span className="kpi-copy"><strong>Completadas</strong><b>{countsByView.done}</b><small>{approvedTotal}</small></span></div><div className="kpi-card"><span className="kpi-icon">↻</span><span className="kpi-copy"><strong>Autopiloto Holded</strong><b>{initialSyncRun?.status || "sin datos"}</b><small>{timeAgo(lastSyncAt)} · {initialSyncRun?.summary || "Pendiente de primera ejecución"}</small></span></div>{initialSyncRun?.last_error ? <div className="kpi-card"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Error última sync</strong><b>Revisar</b><small>{initialSyncRun.last_error}</small></span></div> : null}</section>
    {syncAlert ? <section className="creation-panel" role="alert"><div className="creation-panel-header"><div><div className="eyebrow">Alerta Holded</div><h2>Sincronización no saludable</h2><p>{syncAlert}</p><p>Ejecuta “Sincronizar Holded ahora”. Si vuelve a fallar, revisa la configuración de proveedores y Holded antes de cerrar compras.</p></div><button className="btn" type="button" disabled={savingId === "holded-sync"} onClick={() => void syncHoldedNow()}>{savingId === "holded-sync" ? "Sincronizando..." : "Sincronizar ahora"}</button></div></section> : null}
    <section className="clients-layout"><div className="card clients-main"><div className="client-filters client-filters-wide"><div className="segmented-tabs" role="tablist" aria-label="Vistas de facturas">{viewTabs.map((tab) => <button key={tab.id} type="button" className={activeView === tab.id ? "active" : ""} onClick={() => setActiveView(tab.id)}>{tab.label} <span>{countsByView[tab.id]}</span></button>)}</div><button className="btn" type="button" disabled={savingId === "holded-sync"} onClick={() => void syncHoldedNow()}>{savingId === "holded-sync" ? "Sincronizando..." : "Sincronizar Holded ahora"}</button></div>
      <div className="client-filters client-filters-wide"><input className="input" placeholder="Buscar proveedor, servicio, línea, expediente o moneda..." value={query} onChange={(event) => setQuery(event.target.value)} /><label>Estado<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>Todos</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Proveedor<select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="Todos">Todos</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><button className={showCreate ? "btn secondary" : "btn secondary"} type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cerrar formulario" : "Nueva compra esperada"}</button></div>
      {showCreate ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Nueva compra manual</div><h2>Compra prevista</h2><p>Las líneas con proveedor se generan automáticamente al aceptar el presupuesto; utiliza esto para compras adicionales.</p></div></div><form className="form" onSubmit={createPurchase}><label>Expediente *<select required value={draft.case_id} onChange={(event) => changeDraft("case_id", event.target.value)}><option value="">Selecciona expediente</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.clients?.display_name || item.title || "Expediente"} · {item.currency || "EUR"}</option>)}</select></label><div className="grid grid-2"><label>Proveedor *<select required value={draft.supplier_id} onChange={(event) => changeDraft("supplier_id", event.target.value)}><option value="">Selecciona proveedor</option>{suppliers.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}{item.category ? ` · ${item.category}` : ""}</option>)}</select></label><label>Servicio<input className="input" value={draft.service} onChange={(event) => changeDraft("service", event.target.value)} /></label></div><div className="grid grid-2"><label>Importe<input className="input" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => changeDraft("amount", event.target.value)} /></label><label>Moneda<input className="input" maxLength={3} value={draft.currency} onChange={(event) => changeDraft("currency", event.target.value.toUpperCase())} /></label></div><label>Notas<textarea className="input" rows={3} value={draft.review_notes} onChange={(event) => changeDraft("review_notes", event.target.value)} /></label><div className="form-actions"><a className="btn secondary" href="/proveedores">Gestionar proveedores</a><button className="btn secondary" type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="btn" type="submit" disabled={saving || cases.length === 0 || suppliers.filter((item) => item.active !== false).length === 0}>{saving ? "Guardando..." : "Guardar compra"}</button></div></form></section> : null}
      {message ? <p className="client-message" role="status">{message}</p> : null}
      {activeView === "pending" && pendingBySupplier.length ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Pendientes agrupadas por proveedor</div><h2>Facturas que faltan</h2><p>Routsify controla lo esperado; Holded será la única entrada de facturas recibidas.</p></div></div><div className="grid grid-2">{pendingBySupplier.map((group) => <article key={group.supplierId || group.name} className="card soft-card"><h3>{group.name}</h3><p>{group.count} pendiente{group.count === 1 ? "" : "s"} · {money(group.total, group.items[0]?.currency || "EUR")}</p><small>{group.oldestDays === null ? "Sin fecha esperada" : group.oldestDays < 0 ? `Vencida hace ${Math.abs(group.oldestDays)} días` : `Próxima en ${group.oldestDays} días`} · {group.method || "email"}</small><div className="form-actions"><button className="btn secondary" type="button" onClick={() => { setSupplierFilter(group.supplierId || "Todos"); setQuery(""); }}>Ver pendientes</button>{group.portalUrl ? <a className="btn secondary" href={group.portalUrl} target="_blank" rel="noreferrer">Abrir portal</a> : null}{group.supplierId ? <a className="btn secondary" href={`/proveedores/${encodeURIComponent(group.supplierId)}`}>Abrir proveedor</a> : null}</div></article>)}</div></section> : null}
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio / referencia</th><th>Factura esperada</th><th>Previsto</th><th>Pagado</th><th>Facturado</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{filtered.map((item) => { const expected = expectedCost(item); const paid = paidAmount(item); const invoice = latestInvoice(item); const invoiced = invoiceTotal(item); const deviation = (invoiced || paid) ? (invoiced || paid) - expected : 0; return <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td>{item.cases?.case_code || "—"}<br /><small>{item.currency || item.cases?.currency || "EUR"}</small></td><td><button className="table-link" type="button" onClick={() => selectPurchase(item)}><strong>{item.suppliers?.name || item.supplier_name || "Proveedor"}</strong></button><br /><small>{item.suppliers?.holded_contact_id ? "Holded vinculado" : "Holded pendiente"}</small></td><td>{item.service || item.budget_lines?.description_public || "—"}<br /><small>{item.payment_reference ? `Concepto ${item.payment_reference}` : item.budget_line_id ? "Generada desde presupuesto" : "Compra manual"}</small></td><td>{dateLabel(item.invoice_expected_by || item.due_date || item.budget_lines?.start_date)}<br /><small>{daysFromToday(item.invoice_expected_by || item.due_date || item.budget_lines?.start_date) === null ? "Sin prioridad" : daysFromToday(item.invoice_expected_by || item.due_date || item.budget_lines?.start_date)! < 0 ? `Vencida hace ${Math.abs(daysFromToday(item.invoice_expected_by || item.due_date || item.budget_lines?.start_date)!)} días` : `En ${daysFromToday(item.invoice_expected_by || item.due_date || item.budget_lines?.start_date)} días`}</small></td><td>{money(expected, item.currency || "EUR")}</td><td>{paid ? <>{money(paid, item.currency || "EUR")}<br /><small>{remainingToPay(item) > 0 ? `Faltan ${money(remainingToPay(item), item.currency || "EUR")}` : "Pago completo"}</small></> : "Sin pagar"}</td><td>{invoice ? <>{money(invoice.total_amount || invoice.total || item.invoice_total, invoice.currency || item.currency || "EUR")}<br /><small>{invoice.invoice_number || invoice.holded_purchase_id || "Factura Holded"} · Δ {money(deviation, item.currency || "EUR")}</small></> : paid ? <><span>Sin factura</span><br /><small>{money(paidWithoutInvoice(item), item.currency || "EUR")} pendiente documental</small></> : "Pendiente"}</td><td>{economicStatus(item)}<br /><small>{documentStatus(item)}{item.match_score ? ` · ${Number(item.match_score).toFixed(0)}%` : ""}</small></td><td><RowActionMenu label={`Acciones para ${item.service || item.suppliers?.name || item.supplier_name || "compra"}`}><button type="button" onClick={() => selectPurchase(item)}>Abrir compra</button>{item.cases?.case_code ? <a href={`/expedientes/${encodeURIComponent(item.cases.case_code)}`}>Abrir expediente</a> : null}{item.supplier_id ? <a href={`/proveedores/${encodeURIComponent(item.supplier_id)}`}>Abrir proveedor</a> : null}<button type="button" disabled={savingId === item.id} onClick={() => void syncHoldedNow(item.id)}>{savingId === item.id ? "Buscando…" : "Buscar en Holded"}</button>{canManage ? <button className="danger-text" type="button" disabled={savingId === item.id} onClick={() => void deletePurchase(item)}>{savingId === item.id ? "Eliminando…" : "Eliminar"}</button> : null}</RowActionMenu></td></tr>; })}</tbody></table></div> : <div className="empty-state"><h2>Sin compras</h2><p>Las compras esperadas aparecerán al aceptar una propuesta con líneas marcadas para proveedor.</p></div>}
    </div><aside className="client-side card">{selected ? <><div className="client-side-header compact"><div><h2>{selected.suppliers?.name || selected.supplier_name || "Proveedor"}</h2><p>{selected.service || selected.budget_lines?.description_public || "Servicio"}<br />{selected.cases?.case_code || "Sin expediente visible"}</p></div><span className="status-pill status-progress">{statusLabel(selected.status)}</span></div>
      <section className="side-section"><h3>Relación operativa</h3><table><tbody><tr><th>Expediente</th><td>{selected.cases?.case_code || "—"}</td></tr><tr><th>Moneda</th><td>{selected.currency || selected.cases?.currency || "EUR"}</td></tr><tr><th>Proveedor maestro</th><td>{selected.supplier_id ? "Vinculado" : "Sin vincular"}</td></tr><tr><th>Facturas proveedor</th><td>{selected.suppliers?.invoice_retrieval_method || "email"} · gracia {Number(selected.suppliers?.invoice_grace_days ?? 3)} días</td></tr><tr><th>Origen</th><td>{selected.budget_line_id ? "Línea de presupuesto" : "Manual"}</td></tr><tr><th>Servicio original</th><td>{selected.budget_lines?.description_public || selected.service || "—"}</td></tr><tr><th>Tipo</th><td>{selected.budget_lines?.service_type_code || "—"}</td></tr><tr><th>Destino</th><td>{selected.budget_lines?.destination_segment || "—"}</td></tr><tr><th>Fechas</th><td>{dateRange(selected.budget_lines)}</td></tr></tbody></table>{selected.suppliers?.invoice_retrieval_notes ? <p><small>{selected.suppliers.invoice_retrieval_notes}</small></p> : null}{selected.case_id ? <div className="form-actions"><a className="btn secondary" href={`/expedientes?caseId=${encodeURIComponent(selected.case_id)}`}>Abrir expediente</a><a className="btn secondary" href={`/propuestas?caseId=${encodeURIComponent(selected.case_id)}`}>Abrir presupuesto</a>{selected.suppliers?.invoice_portal_url ? <a className="btn secondary" href={selected.suppliers.invoice_portal_url} target="_blank" rel="noreferrer">Portal facturas</a> : null}{selected.supplier_id ? <a className="btn secondary" href={`/proveedores/${encodeURIComponent(selected.supplier_id)}`}>Ficha proveedor</a> : null}</div> : null}</section>
      <section className="side-section"><h3>Importes y rentabilidad</h3><table><tbody><tr><th>Coste presupuestado</th><td>{money(selectedExpected, selected.currency || "EUR")}</td></tr><tr><th>Pagado proveedor</th><td>{selectedPaid ? money(selectedPaid, selected.currency || "EUR") : "Sin pagar"}</td></tr><tr><th>Factura registrada</th><td>{selectedInvoice ? money(selectedInvoice, selected.currency || "EUR") : "Pendiente"}</td></tr><tr><th>Pagado sin factura</th><td>{paidWithoutInvoice(selected) ? money(paidWithoutInvoice(selected), selected.currency || "EUR") : "—"}</td></tr><tr><th>Pendiente de pagar</th><td>{remainingToPay(selected) ? money(remainingToPay(selected), selected.currency || "EUR") : "—"}</td></tr><tr><th>Coste provisional</th><td>{money(selectedProvisional, selected.currency || "EUR")}</td></tr><tr><th>Coste final</th><td>{selectedFinal ? money(selectedFinal, selected.currency || "EUR") : "Pendiente de factura final"}</td></tr><tr><th>Desviación</th><td>{(selectedFinal || selectedInvoice || selectedPaid) ? money(selectedDeviation, selected.currency || "EUR") : "—"}</td></tr><tr><th>Venta asociada</th><td>{selectedSale ? money(selectedSale, selected.currency || "EUR") : "—"}</td></tr><tr><th>Margen provisional</th><td>{selectedSale ? `${selectedMargin.toFixed(1)}%` : "—"}</td></tr><tr><th>Margen final</th><td>{selectedFinal ? `${selectedFinalMargin.toFixed(1)}%` : "Pendiente"}</td></tr><tr><th>Notas</th><td>{selected.review_notes || "—"}</td></tr></tbody></table></section>
      <section className="side-section"><h3>Pago proveedor</h3><table><tbody><tr><th>Concepto recomendado</th><td>{selected.payment_reference || "Pendiente"}</td></tr><tr><th>Estado económico</th><td>{economicStatus(selected)}</td></tr><tr><th>Estado documental</th><td>{documentStatus(selected)}</td></tr></tbody></table><div className="form-actions">{selected.payment_reference ? <button className="btn secondary" type="button" onClick={() => void navigator.clipboard?.writeText(selected.payment_reference || "")}>Copiar concepto</button> : null}</div><div className="creation-panel compact-panel"><div className="eyebrow">Fallback manual</div><h4>Registrar pago no detectado</h4><p>Úsalo solo si el pago no aparece en Holded ni en una cuenta conectada. No confirma el coste fiscal final; solo registra salida de caja.</p><div className="grid grid-2"><label>Importe pagado<input className="input" type="number" min="0" step="0.01" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} /></label><label>Fecha pago<input className="input" type="date" value={paymentDraft.paid_at} onChange={(event) => setPaymentDraft((current) => ({ ...current, paid_at: event.target.value }))} /></label></div><div className="grid grid-2"><label>Método<input className="input" value={paymentDraft.method} onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value }))} /></label><label>Referencia<input className="input" value={paymentDraft.reference} onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))} /></label></div><button className="btn secondary" type="button" disabled={savingId === `payment-${selected.id}`} onClick={() => void registerSupplierPayment()}>{savingId === `payment-${selected.id}` ? "Registrando..." : "Confirmar pago"}</button></div>{selected.supplier_payment_allocations?.length ? <table><tbody>{selected.supplier_payment_allocations.map((allocation) => { const event = paymentEvent(allocation); return <tr key={allocation.id}><th>{dateLabel(event?.paid_at)}</th><td>{money(allocation.allocated_amount, allocation.currency || selected.currency || "EUR")}<br /><small>{event?.source || allocation.allocation_source} · {event?.payment_reference || event?.holded_payment_id || "sin referencia"}</small></td></tr>; })}</tbody></table> : null}</section>
      {!['approved','not_required','cancelled'].includes(String(selected.status)) ? <section className="side-section"><h3>Factura recibida</h3>{latestInvoice(selected) ? <table><tbody><tr><th>Origen</th><td>Holded</td></tr><tr><th>Número</th><td>{latestInvoice(selected)?.invoice_number || "—"}</td></tr><tr><th>Fecha</th><td>{dateLabel(latestInvoice(selected)?.invoice_date)}</td></tr><tr><th>Total</th><td>{money(latestInvoice(selected)?.total_amount || latestInvoice(selected)?.total || selectedInvoice, latestInvoice(selected)?.currency || selected.currency || "EUR")}</td></tr><tr><th>Estado Holded</th><td>{latestInvoice(selected)?.holded_status || "Detectada"}</td></tr><tr><th>Última sync</th><td>{dateLabel(latestInvoice(selected)?.last_seen_at)}</td></tr></tbody></table> : <p>Sin factura recibida todavía. Sube la factura en Holded y pulsa “Sincronizar Holded ahora”; Routsify la detectará y propondrá la conciliación.</p>}<div className="form-actions">{latestInvoice(selected)?.holded_url ? <a className="btn secondary" href={latestInvoice(selected)?.holded_url || "https://app.holded.com"} target="_blank" rel="noreferrer">Abrir en Holded</a> : null}<button className="btn secondary" type="button" disabled={savingId === selected.id} onClick={() => void syncHoldedNow(selected.id)}>{savingId === selected.id ? "Buscando..." : "Buscar factura en Holded"}</button></div></section> : null}
      <section className="side-section"><h3>Revisión</h3>{["uploaded", "holded_candidate", "matched", "review_needed"].includes(String(selected.status)) ? <><label>Coste real a confirmar<input className="input" type="number" min="0" step="0.01" value={approvalCost} onChange={(event) => setApprovalCost(event.target.value)} /></label><button className="btn" type="button" disabled={savingId === selected.id || !approvalCost.trim() || !(selected.holded_purchase_id || latestInvoice(selected)?.holded_purchase_id)} onClick={() => void updateStatus(selected.id, "approved", { approved_cost: Number(approvalCost), holded_purchase_id: selected.holded_purchase_id || latestInvoice(selected)?.holded_purchase_id })}>Confirmar conciliación</button><p><small>Al confirmar se vincula la factura de Holded, se actualiza el coste real y se recalculan beneficio, margen y desviación. Si Holded cambia después, volverá a revisión.</small></p></> : null}<button className="btn secondary" type="button" disabled={savingId === selected.id || ["approved", "not_required", "cancelled"].includes(String(selected.status))} onClick={() => void updateStatus(selected.id, "requested")}>Marcar como solicitada</button><label>Motivo para no requerir factura<textarea className="input" rows={2} value={notRequiredReason} onChange={(event) => setNotRequiredReason(event.target.value)} /></label><button className="btn secondary" type="button" disabled={savingId === selected.id || notRequiredReason.trim().length < 5 || ['approved','not_required','cancelled'].includes(String(selected.status))} onClick={() => void updateStatus(selected.id, "not_required", { reason: notRequiredReason })}>Marcar no necesaria</button></section></> : <div className="empty-state"><h2>Sin compra seleccionada</h2></div>}</aside></section>
  </div>;
}
