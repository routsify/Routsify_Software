"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";

type CaseOption = { id: string; case_code: string; title?: string | null; currency?: string | null; clients?: { display_name?: string | null } | null };
type Supplier = { id: string; name: string; category?: string | null; active?: boolean };
type SupplierInvoice = { id: string; status?: string | null; invoice_number?: string | null; invoice_date?: string | null; total?: number | string | null; total_amount?: number | string | null; currency?: string | null; created_at?: string | null };
type BudgetLine = { id?: string; service_type_code?: string | null; description_public?: string | null; description_internal?: string | null; destination_segment?: string | null; start_date?: string | null; end_date?: string | null; cost_budget?: number | string | null; cost_real?: number | string | null; cost_real_source?: string | null; sale_price?: number | string | null; supplier_id?: string | null; supplier_name?: string | null };
type Purchase = {
  id: string;
  case_id?: string | null;
  proposal_version_id?: string | null;
  budget_line_id?: string | null;
  supplier_id?: string | null;
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
  currency?: string | null;
  due_date?: string | null;
  review_notes?: string | null;
  supplier_invoices?: SupplierInvoice[];
};
type Draft = { case_id: string; supplier_id: string; service: string; amount: string; currency: string; status: string; review_notes: string };
type InvoiceDraft = { invoiceNumber: string; invoiceDate: string; invoiceBase: string; invoiceTax: string; invoiceTotal: string; currency: string };

const statusOptions = [
  ["expected", "Pendiente"], ["requested", "Solicitada"], ["uploaded", "Documento recibido"],
  ["holded_candidate", "Candidata en Holded"], ["matched", "Conciliada"],
  ["review_needed", "Revisión necesaria"], ["approved", "Aprobada"],
  ["not_required", "No necesaria"], ["cancelled", "Cancelada"],
] as const;
const emptyDraft: Draft = { case_id: "", supplier_id: "", service: "", amount: "", currency: "EUR", status: "expected", review_notes: "" };
const emptyInvoice: InvoiceDraft = { invoiceNumber: "", invoiceDate: "", invoiceBase: "", invoiceTax: "", invoiceTotal: "", currency: "EUR" };

function one<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] as T | undefined) || null : value && typeof value === "object" ? value as T : null; }
function normalize(input: unknown): Purchase {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || crypto.randomUUID()),
    case_id: row.case_id ? String(row.case_id) : null,
    proposal_version_id: row.proposal_version_id ? String(row.proposal_version_id) : null,
    budget_line_id: row.budget_line_id ? String(row.budget_line_id) : null,
    supplier_id: row.supplier_id ? String(row.supplier_id) : null,
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
    currency: row.currency ? String(row.currency) : String(one<Purchase["cases"]>(row.cases)?.currency || "EUR"),
    due_date: row.due_date ? String(row.due_date) : null,
    review_notes: row.review_notes ? String(row.review_notes) : null,
    supplier_invoices: Array.isArray(row.supplier_invoices) ? row.supplier_invoices as SupplierInvoice[] : [],
  };
}
function normalizeCase(input: unknown): CaseOption { const row = input as Record<string, unknown>; const rawClient = Array.isArray(row.clients) ? row.clients[0] : row.clients; return { id: String(row.id || ""), case_code: String(row.case_code || "Expediente"), title: row.title ? String(row.title) : null, currency: row.currency ? String(row.currency) : "EUR", clients: rawClient && typeof rawClient === "object" ? rawClient as CaseOption["clients"] : null }; }
function normalizeSupplier(input: unknown): Supplier { const row = input as Record<string, unknown>; return { id: String(row.id || ""), name: String(row.name || "Proveedor"), category: row.category ? String(row.category) : null, active: row.active !== false }; }
function statusLabel(value?: string | null) { return statusOptions.find(([key]) => key === value)?.[1] || value || "Pendiente"; }
function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0)); }
function optionalNumber(value: string) { return value.trim() ? Number(value) : null; }
function dateRange(line?: BudgetLine | null) { if (!line?.start_date && !line?.end_date) return "—"; return `${line.start_date || "—"} → ${line.end_date || "—"}`; }
function invoiceTotal(item: Purchase) { const invoices = [...(item.supplier_invoices || [])].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))); return Number(item.invoice_total || invoices[0]?.total_amount || invoices[0]?.total || 0); }
function expectedCost(item: Purchase) { return Number(item.expected_amount || item.budget_lines?.cost_budget || item.amount || 0); }
function realCost(item: Purchase) { return Number(item.approved_cost || item.budget_lines?.cost_real || 0); }
function defaultApprovalCost(item: Purchase | null) { return item ? String(invoiceTotal(item) || expectedCost(item) || "") : ""; }
function breakdown(items: Purchase[], selector: (item: Purchase) => number) {
  const totals = new Map<string, number>();
  for (const item of items) { const currency = String(item.currency || item.cases?.currency || "EUR"); totals.set(currency, (totals.get(currency) || 0) + selector(item)); }
  return [...totals.entries()].filter(([, value]) => value !== 0).sort(([left], [right]) => left.localeCompare(right)).map(([currency, value]) => money(value, currency)).join(" · ") || money(0, "EUR");
}

export function PurchasesManagerOperational({ initialPurchases = [], initialCases = [], initialSuppliers = [], initialCaseId = "", initialSupplierId = "" }: { initialPurchases?: unknown[]; initialCases?: unknown[]; initialSuppliers?: unknown[]; initialCaseId?: string; initialSupplierId?: string }) {
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
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierId || "Todos");
  const [showCreate, setShowCreate] = useState(Boolean(initialCaseId && !normalizedItems.some((item) => item.case_id === initialCaseId)));
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft, case_id: initialCase?.id || "", currency: initialCase?.currency || "EUR", supplier_id: suppliers.some((item) => item.id === initialSupplierId && item.active !== false) ? initialSupplierId : "" }));
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(() => ({ ...emptyInvoice, currency: initialSelected?.currency || "EUR" }));
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [approvalCost, setApprovalCost] = useState(() => defaultApprovalCost(initialSelected));
  const [notRequiredReason, setNotRequiredReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.suppliers?.name, item.supplier_name, item.service, item.cases?.case_code, item.currency, item.budget_lines?.description_public, item.budget_lines?.destination_segment].filter(Boolean).join(" ").toLowerCase();
    return (filter === "Todos" || item.status === filter) && (supplierFilter === "Todos" || item.supplier_id === supplierFilter) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [items, query, filter, supplierFilter]);
  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0] || null;
  const pending = items.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status))).length;
  const forecastTotal = breakdown(items, expectedCost);
  const approvedTotal = breakdown(items, realCost);

  function changeDraft(key: keyof Draft, value: string) {
    setDraft((current) => {
      if (key !== "case_id") return { ...current, [key]: value };
      const selectedCase = cases.find((item) => item.id === value);
      return { ...current, case_id: value, currency: selectedCase?.currency || current.currency || "EUR" };
    });
  }
  function changeInvoice(key: keyof InvoiceDraft, value: string) { setInvoiceDraft((current) => ({ ...current, [key]: value })); }
  function selectPurchase(item: Purchase) { setSelectedId(item.id); setApprovalCost(defaultApprovalCost(item)); setNotRequiredReason(""); setInvoiceDraft((current) => ({ ...current, currency: item.currency || item.cases?.currency || "EUR" })); }
  function replaceItem(input: unknown) { const updated = normalize(input); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); setSelectedId(updated.id); setApprovalCost(defaultApprovalCost(updated)); }

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

  async function refreshPurchase(id: string) { const response = await fetch(`/api/routsify/expected-purchases/${encodeURIComponent(id)}`); const result = await response.json().catch(() => null); if (response.ok && result?.ok) replaceItem(result.data); }

  async function uploadInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !selected.case_id || !selected.cases?.case_code) return setMessage("La compra debe estar vinculada a un expediente válido.");
    if (!invoiceFile) return setMessage("Selecciona el PDF o imagen de la factura.");
    setSavingId(selected.id); setMessage(null);
    try {
      const signedResponse = await fetch("/api/documentos/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseCode: selected.cases.case_code, fileName: invoiceFile.name, sizeBytes: invoiceFile.size, mimeType: invoiceFile.type, ownerType: "supplier_invoice", ownerId: selected.id }) });
      const signed = await signedResponse.json(); if (!signedResponse.ok || !signed.ok || !signed.signedUrl) throw new Error(signed.error || "No se pudo preparar la subida.");
      const uploadResponse = await fetch(signed.signedUrl, { method: "PUT", headers: { "content-type": invoiceFile.type }, body: invoiceFile }); if (!uploadResponse.ok) throw new Error("El archivo no pudo subirse al almacenamiento privado.");
      const confirmResponse = await fetch("/api/documentos/confirm-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerType: "supplier_invoice", ownerId: selected.id, caseId: selected.case_id, bucket: signed.bucket, storagePath: signed.path, fileName: invoiceFile.name, mimeType: invoiceFile.type, sizeBytes: invoiceFile.size, title: `Factura ${selected.suppliers?.name || selected.supplier_name || "proveedor"}`, invoiceNumber: invoiceDraft.invoiceNumber || null, invoiceDate: invoiceDraft.invoiceDate || null, invoiceBase: optionalNumber(invoiceDraft.invoiceBase), invoiceTax: optionalNumber(invoiceDraft.invoiceTax), invoiceTotal: optionalNumber(invoiceDraft.invoiceTotal), currency: invoiceDraft.currency || selected.currency || "EUR", retentionDays: 365 }) });
      const confirmed = await confirmResponse.json(); if (!confirmResponse.ok || !confirmed.ok) throw new Error(confirmed.error || "No se pudo registrar la factura.");
      await refreshPurchase(selected.id); setInvoiceDraft({ ...emptyInvoice, currency: selected.currency || "EUR" }); setInvoiceFile(null); setMessage("Factura subida y vinculada. Revisa el coste real antes de aprobarla.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo subir la factura."); } finally { setSavingId(null); }
  }

  const selectedExpected = selected ? expectedCost(selected) : 0;
  const selectedReal = selected ? realCost(selected) : 0;
  const selectedInvoice = selected ? invoiceTotal(selected) : 0;
  const selectedDeviation = selectedReal ? selectedReal - selectedExpected : 0;
  const selectedSale = Number(selected?.budget_lines?.sale_price || 0);
  const selectedProfit = selectedSale ? selectedSale - (selectedReal || selectedExpected) : 0;
  const selectedMargin = selectedSale ? (selectedProfit / selectedSale) * 100 : 0;

  return <div className="clients-page">
    <section className="client-kpis"><div className="kpi-card"><span className="kpi-icon">C</span><span className="kpi-copy"><strong>Compras</strong><b>{items.length}</b><small>Total registradas</small></span></div><div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Pendientes</strong><b>{pending}</b><small>Por resolver</small></span></div><div className="kpi-card"><span className="kpi-icon">$</span><span className="kpi-copy"><strong>Coste previsto</strong><b>{forecastTotal}</b><small>Separado por moneda</small></span></div><div className="kpi-card"><span className="kpi-icon">R</span><span className="kpi-copy"><strong>Coste real aprobado</strong><b>{approvedTotal}</b><small>Separado por moneda</small></span></div></section>
    <section className="clients-layout"><div className="card clients-main"><div className="client-filters client-filters-wide"><input className="input" placeholder="Buscar proveedor, servicio, línea, expediente o moneda..." value={query} onChange={(event) => setQuery(event.target.value)} /><label>Estado<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>Todos</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Proveedor<select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="Todos">Todos</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cerrar formulario" : "Nueva compra manual"}</button></div>
      {showCreate ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Nueva compra manual</div><h2>Compra prevista</h2><p>Las líneas con proveedor se generan automáticamente al aceptar el presupuesto; utiliza esto para compras adicionales.</p></div></div><form className="form" onSubmit={createPurchase}><label>Expediente *<select required value={draft.case_id} onChange={(event) => changeDraft("case_id", event.target.value)}><option value="">Selecciona expediente</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.clients?.display_name || item.title || "Expediente"} · {item.currency || "EUR"}</option>)}</select></label><div className="grid grid-2"><label>Proveedor *<select required value={draft.supplier_id} onChange={(event) => changeDraft("supplier_id", event.target.value)}><option value="">Selecciona proveedor</option>{suppliers.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}{item.category ? ` · ${item.category}` : ""}</option>)}</select></label><label>Servicio<input className="input" value={draft.service} onChange={(event) => changeDraft("service", event.target.value)} /></label></div><div className="grid grid-2"><label>Importe<input className="input" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => changeDraft("amount", event.target.value)} /></label><label>Moneda<input className="input" maxLength={3} value={draft.currency} onChange={(event) => changeDraft("currency", event.target.value.toUpperCase())} /></label></div><label>Notas<textarea className="input" rows={3} value={draft.review_notes} onChange={(event) => changeDraft("review_notes", event.target.value)} /></label><div className="form-actions"><a className="btn secondary" href="/proveedores">Gestionar proveedores</a><button className="btn secondary" type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="btn" type="submit" disabled={saving || cases.length === 0 || suppliers.filter((item) => item.active !== false).length === 0}>{saving ? "Guardando..." : "Guardar compra"}</button></div></form></section> : null}
      {message ? <p className="client-message" role="status">{message}</p> : null}
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio / línea</th><th>Previsto</th><th>Real</th><th>Desviación</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{filtered.map((item) => { const expected = expectedCost(item); const real = realCost(item); const deviation = real ? real - expected : 0; return <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td>{item.cases?.case_code || "—"}<br /><small>{item.currency || item.cases?.currency || "EUR"}</small></td><td><button className="table-link" type="button" onClick={() => selectPurchase(item)}><strong>{item.suppliers?.name || item.supplier_name || "Proveedor"}</strong></button></td><td>{item.service || item.budget_lines?.description_public || "—"}<br /><small>{item.budget_line_id ? "Generada desde presupuesto" : "Compra manual"}</small></td><td>{money(expected, item.currency || "EUR")}</td><td>{real ? money(real, item.currency || "EUR") : "Pendiente"}</td><td>{real ? money(deviation, item.currency || "EUR") : "—"}</td><td>{statusLabel(item.status)}</td><td><details className="row-action-menu"><summary aria-label={`Acciones para ${item.service || item.suppliers?.name || item.supplier_name || "compra"}`}>•••</summary><div><button type="button" onClick={() => selectPurchase(item)}>Abrir compra</button>{item.cases?.case_code ? <a href={`/expedientes/${encodeURIComponent(item.cases.case_code)}`}>Abrir expediente</a> : null}{item.supplier_id ? <a href={`/proveedores/${encodeURIComponent(item.supplier_id)}`}>Abrir proveedor</a> : null}{canManage ? <button className="danger-text" type="button" disabled={savingId === item.id} onClick={() => void deletePurchase(item)}>{savingId === item.id ? "Eliminando…" : "Eliminar"}</button> : null}</div></details></td></tr>; })}</tbody></table></div> : <div className="empty-state"><h2>Sin compras</h2><p>Las compras esperadas aparecerán al aceptar una propuesta con líneas marcadas para proveedor.</p></div>}
    </div><aside className="client-side card">{selected ? <><div className="client-side-header compact"><div><h2>{selected.suppliers?.name || selected.supplier_name || "Proveedor"}</h2><p>{selected.service || selected.budget_lines?.description_public || "Servicio"}<br />{selected.cases?.case_code || "Sin expediente visible"}</p></div><span className="status-pill status-progress">{statusLabel(selected.status)}</span></div>
      <section className="side-section"><h3>Relación operativa</h3><table><tbody><tr><th>Expediente</th><td>{selected.cases?.case_code || "—"}</td></tr><tr><th>Moneda</th><td>{selected.currency || selected.cases?.currency || "EUR"}</td></tr><tr><th>Proveedor maestro</th><td>{selected.supplier_id ? "Vinculado" : "Sin vincular"}</td></tr><tr><th>Origen</th><td>{selected.budget_line_id ? "Línea de presupuesto" : "Manual"}</td></tr><tr><th>Servicio original</th><td>{selected.budget_lines?.description_public || selected.service || "—"}</td></tr><tr><th>Tipo</th><td>{selected.budget_lines?.service_type_code || "—"}</td></tr><tr><th>Destino</th><td>{selected.budget_lines?.destination_segment || "—"}</td></tr><tr><th>Fechas</th><td>{dateRange(selected.budget_lines)}</td></tr></tbody></table>{selected.case_id ? <div className="form-actions"><a className="btn secondary" href={`/expedientes?caseId=${encodeURIComponent(selected.case_id)}`}>Abrir expediente</a><a className="btn secondary" href={`/propuestas?caseId=${encodeURIComponent(selected.case_id)}`}>Abrir presupuesto</a>{selected.supplier_id ? <a className="btn secondary" href={`/proveedores/${encodeURIComponent(selected.supplier_id)}`}>Ficha proveedor</a> : null}</div> : null}</section>
      <section className="side-section"><h3>Importes y rentabilidad</h3><table><tbody><tr><th>Coste presupuestado</th><td>{money(selectedExpected, selected.currency || "EUR")}</td></tr><tr><th>Factura registrada</th><td>{selectedInvoice ? money(selectedInvoice, selected.currency || "EUR") : "Pendiente"}</td></tr><tr><th>Coste real aprobado</th><td>{selectedReal ? money(selectedReal, selected.currency || "EUR") : "Pendiente"}</td></tr><tr><th>Desviación</th><td>{selectedReal ? money(selectedDeviation, selected.currency || "EUR") : "—"}</td></tr><tr><th>Venta asociada</th><td>{selectedSale ? money(selectedSale, selected.currency || "EUR") : "—"}</td></tr><tr><th>Beneficio actual</th><td>{selectedSale ? money(selectedProfit, selected.currency || "EUR") : "—"}</td></tr><tr><th>Margen actual</th><td>{selectedSale ? `${selectedMargin.toFixed(1)}%` : "—"}</td></tr><tr><th>Facturas</th><td>{selected.supplier_invoices?.length || 0}</td></tr><tr><th>Notas</th><td>{selected.review_notes || "—"}</td></tr></tbody></table></section>
      {!['approved','not_required','cancelled'].includes(String(selected.status)) ? <section className="side-section"><h3>Subir factura proveedor</h3><form className="form" onSubmit={uploadInvoice}><label>Archivo PDF/JPG/PNG<input className="input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setInvoiceFile(event.target.files?.[0] || null)} /></label><div className="grid grid-2"><label>Número<input className="input" value={invoiceDraft.invoiceNumber} onChange={(event) => changeInvoice("invoiceNumber", event.target.value)} /></label><label>Fecha<input className="input" type="date" value={invoiceDraft.invoiceDate} onChange={(event) => changeInvoice("invoiceDate", event.target.value)} /></label></div><div className="grid grid-2"><label>Base<input className="input" type="number" min="0" step="0.01" value={invoiceDraft.invoiceBase} onChange={(event) => changeInvoice("invoiceBase", event.target.value)} /></label><label>Impuestos<input className="input" type="number" min="0" step="0.01" value={invoiceDraft.invoiceTax} onChange={(event) => changeInvoice("invoiceTax", event.target.value)} /></label></div><div className="grid grid-2"><label>Total<input className="input" type="number" min="0" step="0.01" value={invoiceDraft.invoiceTotal} onChange={(event) => changeInvoice("invoiceTotal", event.target.value)} /></label><label>Moneda<input className="input" maxLength={3} value={invoiceDraft.currency} onChange={(event) => changeInvoice("currency", event.target.value.toUpperCase())} /></label></div><button className="btn" type="submit" disabled={savingId === selected.id}>{savingId === selected.id ? "Subiendo..." : "Subir y vincular"}</button></form></section> : null}
      <section className="side-section"><h3>Revisión</h3>{["uploaded", "matched", "review_needed"].includes(String(selected.status)) ? <><label>Coste real a aprobar<input className="input" type="number" min="0" step="0.01" value={approvalCost} onChange={(event) => setApprovalCost(event.target.value)} /></label><button className="btn" type="button" disabled={savingId === selected.id || !approvalCost.trim()} onClick={() => void updateStatus(selected.id, "approved", { approved_cost: Number(approvalCost) })}>Aprobar coste real</button><p><small>Al aprobar se actualiza la línea del presupuesto y se recalculan beneficio, margen real y desviación.</small></p></> : null}<button className="btn secondary" type="button" disabled={savingId === selected.id || ["approved", "not_required", "cancelled"].includes(String(selected.status))} onClick={() => void updateStatus(selected.id, "requested")}>Marcar como solicitada</button><label>Motivo para no requerir factura<textarea className="input" rows={2} value={notRequiredReason} onChange={(event) => setNotRequiredReason(event.target.value)} /></label><button className="btn secondary" type="button" disabled={savingId === selected.id || notRequiredReason.trim().length < 5 || ['approved','not_required','cancelled'].includes(String(selected.status))} onClick={() => void updateStatus(selected.id, "not_required", { reason: notRequiredReason })}>Marcar no necesaria</button></section></> : <div className="empty-state"><h2>Sin compra seleccionada</h2></div>}</aside></section>
  </div>;
}
