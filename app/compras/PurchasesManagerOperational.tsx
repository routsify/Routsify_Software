"use client";

import { FormEvent, useMemo, useState } from "react";

type CaseOption = { id: string; case_code: string; title?: string | null; clients?: { display_name?: string | null } | null };
type SupplierInvoice = { id: string; status?: string | null; invoice_number?: string | null; invoice_date?: string | null; total?: number | string | null; currency?: string | null };
type Purchase = {
  id: string;
  case_id?: string | null;
  cases?: { case_code?: string | null } | null;
  supplier_name?: string | null;
  service?: string | null;
  status?: string | null;
  amount?: number | string | null;
  expected_amount?: number | string | null;
  currency?: string | null;
  review_notes?: string | null;
  supplier_invoices?: SupplierInvoice[];
};
type Draft = { case_id: string; supplier_name: string; service: string; amount: string; currency: string; status: string; review_notes: string };
type InvoiceDraft = { invoiceNumber: string; invoiceDate: string; invoiceBase: string; invoiceTax: string; invoiceTotal: string; currency: string };

const statusOptions = [
  ["expected", "Pendiente"], ["requested", "Solicitada"], ["uploaded", "Documento recibido"],
  ["holded_candidate", "Candidata en Holded"], ["matched", "Conciliada"],
  ["review_needed", "Revisión necesaria"], ["approved", "Aprobada"],
  ["not_required", "No necesaria"], ["cancelled", "Cancelada"],
] as const;
const emptyDraft: Draft = { case_id: "", supplier_name: "", service: "", amount: "", currency: "EUR", status: "expected", review_notes: "" };
const emptyInvoice: InvoiceDraft = { invoiceNumber: "", invoiceDate: "", invoiceBase: "", invoiceTax: "", invoiceTotal: "", currency: "EUR" };

function normalize(input: unknown): Purchase {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || crypto.randomUUID()),
    case_id: row.case_id ? String(row.case_id) : null,
    cases: row.cases && typeof row.cases === "object" ? row.cases as Purchase["cases"] : null,
    supplier_name: row.supplier_name ? String(row.supplier_name) : null,
    service: row.service ? String(row.service) : null,
    status: row.status ? String(row.status) : "expected",
    amount: (typeof row.amount === "number" || typeof row.amount === "string") ? row.amount : row.expected_amount as number | string | null,
    expected_amount: row.expected_amount as number | string | null,
    currency: row.currency ? String(row.currency) : "EUR",
    review_notes: row.review_notes ? String(row.review_notes) : null,
    supplier_invoices: Array.isArray(row.supplier_invoices) ? row.supplier_invoices as SupplierInvoice[] : [],
  };
}
function normalizeCase(input: unknown): CaseOption {
  const row = input as Record<string, unknown>;
  return { id: String(row.id || ""), case_code: String(row.case_code || "Expediente"), title: row.title ? String(row.title) : null, clients: row.clients && typeof row.clients === "object" ? row.clients as CaseOption["clients"] : null };
}
function statusLabel(value?: string | null) { return statusOptions.find(([key]) => key === value)?.[1] || value || "Pendiente"; }
function money(value: unknown, currency = "EUR") { const amount = Number(value || 0); return amount ? new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount) : "—"; }
function optionalNumber(value: string) { return value.trim() ? Number(value) : null; }

export function PurchasesManagerOperational({ initialPurchases = [], initialCases = [], initialCaseId = "" }: { initialPurchases?: unknown[]; initialCases?: unknown[]; initialCaseId?: string }) {
  const [items, setItems] = useState<Purchase[]>(() => initialPurchases.map(normalize));
  const [cases] = useState<CaseOption[]>(() => initialCases.map(normalizeCase).filter((item) => item.id));
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id || null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [showCreate, setShowCreate] = useState(Boolean(initialCaseId));
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft, case_id: cases.some((item) => item.id === initialCaseId) ? initialCaseId : "" }));
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(emptyInvoice);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [notRequiredReason, setNotRequiredReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.supplier_name, item.service, item.cases?.case_code].filter(Boolean).join(" ").toLowerCase();
    return (filter === "Todos" || item.status === filter) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [items, query, filter]);
  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0] || null;
  const pending = items.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status))).length;
  const review = items.filter((item) => item.status === "review_needed").length;
  const total = items.reduce((sum, item) => sum + Number(item.amount || item.expected_amount || 0), 0);

  function changeDraft(key: keyof Draft, value: string) { setDraft((current) => ({ ...current, [key]: value })); }
  function changeInvoice(key: keyof InvoiceDraft, value: string) { setInvoiceDraft((current) => ({ ...current, [key]: value })); }
  function replaceItem(input: unknown) {
    const updated = normalize(input);
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    setSelectedId(updated.id);
  }

  async function createPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(draft.amount || 0);
    if (!draft.case_id) return setMessage("Selecciona un expediente.");
    if (!draft.supplier_name.trim()) return setMessage("Introduce el proveedor.");
    if (!Number.isFinite(amount) || amount < 0) return setMessage("El importe no es válido.");
    setSaving(true); setMessage(null);
    const response = await fetch("/api/routsify/expected-purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, supplier_name: draft.supplier_name.trim(), service: draft.service.trim() || null, amount, currency: draft.currency.trim().toUpperCase() || "EUR", review_notes: draft.review_notes.trim() || null }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo crear la compra."));
    const created = normalize(result.data); setItems((current) => [created, ...current]); setSelectedId(created.id); setDraft(emptyDraft); setShowCreate(false); setMessage("Compra creada correctamente.");
  }

  async function updateStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    setSavingId(id); setMessage(null);
    const response = await fetch(`/api/routsify/expected-purchases/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, ...extra }) });
    const result = await response.json().catch(() => null); setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar la compra."));
    replaceItem(result.data); setMessage("Estado actualizado.");
  }

  async function refreshPurchase(id: string) {
    const response = await fetch(`/api/routsify/expected-purchases/${encodeURIComponent(id)}`);
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) replaceItem(result.data);
  }

  async function uploadInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !selected.case_id || !selected.cases?.case_code) return setMessage("La compra debe estar vinculada a un expediente válido.");
    if (!invoiceFile) return setMessage("Selecciona el PDF o imagen de la factura.");
    setSavingId(selected.id); setMessage(null);
    try {
      const signedResponse = await fetch("/api/documentos/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseCode: selected.cases.case_code, fileName: invoiceFile.name, sizeBytes: invoiceFile.size, mimeType: invoiceFile.type, ownerType: "supplier_invoice", ownerId: selected.id }),
      });
      const signed = await signedResponse.json();
      if (!signedResponse.ok || !signed.ok || !signed.signedUrl) throw new Error(signed.error || "No se pudo preparar la subida.");
      const uploadResponse = await fetch(signed.signedUrl, { method: "PUT", headers: { "content-type": invoiceFile.type }, body: invoiceFile });
      if (!uploadResponse.ok) throw new Error("El archivo no pudo subirse al almacenamiento privado.");
      const confirmResponse = await fetch("/api/documentos/confirm-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerType: "supplier_invoice", ownerId: selected.id, caseId: selected.case_id, bucket: signed.bucket,
          storagePath: signed.path, fileName: invoiceFile.name, mimeType: invoiceFile.type, sizeBytes: invoiceFile.size,
          title: `Factura ${selected.supplier_name || "proveedor"}`, invoiceNumber: invoiceDraft.invoiceNumber || null,
          invoiceDate: invoiceDraft.invoiceDate || null, invoiceBase: optionalNumber(invoiceDraft.invoiceBase),
          invoiceTax: optionalNumber(invoiceDraft.invoiceTax), invoiceTotal: optionalNumber(invoiceDraft.invoiceTotal),
          currency: invoiceDraft.currency || "EUR", retentionDays: 365,
        }),
      });
      const confirmed = await confirmResponse.json();
      if (!confirmResponse.ok || !confirmed.ok) throw new Error(confirmed.error || "No se pudo registrar la factura.");
      await refreshPurchase(selected.id);
      setInvoiceDraft(emptyInvoice); setInvoiceFile(null); setMessage("Factura subida y vinculada. Queda pendiente de revisión.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo subir la factura.");
    } finally {
      setSavingId(null);
    }
  }

  return <div className="clients-page">
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">C</span><span className="kpi-copy"><strong>Compras</strong><b>{items.length}</b><small>Total registradas</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Pendientes</strong><b>{pending}</b><small>Por resolver</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">R</span><span className="kpi-copy"><strong>Revisión</strong><b>{review}</b><small>Necesitan decisión</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Importe</strong><b>{money(total)}</b><small>Registrado</small></span></div>
    </section>
    <section className="clients-layout">
      <div className="card clients-main">
        <div className="client-filters client-filters-wide"><input className="input" placeholder="Buscar proveedor, servicio o expediente..." value={query} onChange={(event) => setQuery(event.target.value)} /><label>Estado<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>Todos</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cerrar formulario" : "Nueva compra"}</button></div>
        {showCreate ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Nueva compra</div><h2>Compra prevista</h2><p>Vincúlala a un expediente para mantener el control de rentabilidad.</p></div></div><form className="form" onSubmit={createPurchase}><label>Expediente *<select required value={draft.case_id} onChange={(event) => changeDraft("case_id", event.target.value)}><option value="">Selecciona expediente</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.clients?.display_name || item.title || "Expediente"}</option>)}</select></label><div className="grid grid-2"><label>Proveedor *<input className="input" required value={draft.supplier_name} onChange={(event) => changeDraft("supplier_name", event.target.value)} /></label><label>Servicio<input className="input" value={draft.service} onChange={(event) => changeDraft("service", event.target.value)} /></label></div><div className="grid grid-2"><label>Importe<input className="input" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => changeDraft("amount", event.target.value)} /></label><label>Moneda<input className="input" maxLength={3} value={draft.currency} onChange={(event) => changeDraft("currency", event.target.value)} /></label></div><label>Notas<textarea className="input" rows={3} value={draft.review_notes} onChange={(event) => changeDraft("review_notes", event.target.value)} /></label><div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="btn" disabled={saving || cases.length === 0}>{saving ? "Guardando..." : "Guardar compra"}</button></div></form></section> : null}
        {message ? <p className="client-message">{message}</p> : null}
        {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio</th><th>Importe</th><th>Estado</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td>{item.cases?.case_code || "—"}</td><td><button className="table-link" onClick={() => setSelectedId(item.id)}><strong>{item.supplier_name || "Proveedor"}</strong></button></td><td>{item.service || "—"}</td><td>{money(item.amount || item.expected_amount, item.currency || "EUR")}</td><td>{statusLabel(item.status)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h2>Sin compras</h2><p>Las compras esperadas se generan automáticamente al aceptar una propuesta.</p></div>}
      </div>
      <aside className="client-side card">{selected ? <><div className="client-side-header compact"><div><h2>{selected.supplier_name || "Proveedor"}</h2><p>{selected.service || "Servicio"}<br />{selected.cases?.case_code || "Sin expediente visible"}</p></div><span className="status-pill status-progress">{statusLabel(selected.status)}</span></div><section className="side-section"><h3>Resumen</h3><table><tbody><tr><th>Importe</th><td>{money(selected.amount || selected.expected_amount, selected.currency || "EUR")}</td></tr><tr><th>Estado</th><td>{statusLabel(selected.status)}</td></tr><tr><th>Facturas</th><td>{selected.supplier_invoices?.length || 0}</td></tr><tr><th>Notas</th><td>{selected.review_notes || "—"}</td></tr></tbody></table></section>
        {!['approved','not_required','cancelled'].includes(String(selected.status)) ? <section className="side-section"><h3>Subir factura proveedor</h3><form className="form" onSubmit={uploadInvoice}><label>Archivo PDF/JPG/PNG<input className="input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setInvoiceFile(event.target.files?.[0] || null)} /></label><div className="grid grid-2"><label>Número<input className="input" value={invoiceDraft.invoiceNumber} onChange={(event) => changeInvoice("invoiceNumber", event.target.value)} /></label><label>Fecha<input className="input" type="date" value={invoiceDraft.invoiceDate} onChange={(event) => changeInvoice("invoiceDate", event.target.value)} /></label></div><div className="grid grid-2"><label>Base<input className="input" type="number" min="0" step="0.01" value={invoiceDraft.invoiceBase} onChange={(event) => changeInvoice("invoiceBase", event.target.value)} /></label><label>Impuestos<input className="input" type="number" min="0" step="0.01" value={invoiceDraft.invoiceTax} onChange={(event) => changeInvoice("invoiceTax", event.target.value)} /></label></div><div className="grid grid-2"><label>Total<input className="input" type="number" min="0" step="0.01" value={invoiceDraft.invoiceTotal} onChange={(event) => changeInvoice("invoiceTotal", event.target.value)} /></label><label>Moneda<input className="input" maxLength={3} value={invoiceDraft.currency} onChange={(event) => changeInvoice("currency", event.target.value.toUpperCase())} /></label></div><button className="btn" disabled={savingId === selected.id}>{savingId === selected.id ? "Subiendo..." : "Subir y vincular"}</button></form></section> : null}
        <section className="side-section"><h3>Revisión</h3>{selected.status === "uploaded" || selected.status === "matched" || selected.status === "review_needed" ? <button className="btn" type="button" disabled={savingId === selected.id} onClick={() => void updateStatus(selected.id, "approved")}>Aprobar factura</button> : null}<button className="btn secondary" type="button" disabled={savingId === selected.id} onClick={() => void updateStatus(selected.id, "requested")}>Marcar como solicitada</button><label>Motivo para no requerir factura<textarea className="input" rows={2} value={notRequiredReason} onChange={(event) => setNotRequiredReason(event.target.value)} /></label><button className="btn secondary" type="button" disabled={savingId === selected.id || notRequiredReason.trim().length < 5} onClick={() => void updateStatus(selected.id, "not_required", { reason: notRequiredReason })}>Marcar no necesaria</button></section></> : <div className="empty-state"><h2>Sin compra seleccionada</h2></div>}</aside>
    </section>
  </div>;
}
