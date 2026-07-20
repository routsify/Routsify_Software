"use client";

import { FormEvent, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";

type Row = Record<string, unknown>;
type Draft = { name: string; category: string; destination: string; currency: string; unit: string; base_cost: string; tax_rate: string; valid_from: string; valid_until: string; notes: string };
const emptyDraft: Draft = { name: "", category: "", destination: "", currency: "EUR", unit: "persona", base_cost: "", tax_rate: "", valid_from: "", valid_until: "", notes: "" };

function text(value: unknown) { return String(value ?? "").trim(); }
function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0)); }
function date(value: unknown) { const raw = text(value); return raw ? new Date(`${raw.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES") : "—"; }

export function SupplierServicesPanel({ supplierId, initialServices }: { supplierId: string; initialServices: Row[] }) {
  const canManage = usePermission("suppliers.manage");
  const [services, setServices] = useState(initialServices);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/suppliers/${encodeURIComponent(supplierId)}/services`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, base_cost: draft.base_cost === "" ? null : Number(draft.base_cost), tax_rate: draft.tax_rate === "" ? null : Number(draft.tax_rate), valid_from: draft.valid_from || null, valid_until: draft.valid_until || null }),
    });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) { setMessage(String(result?.error || "No se pudo crear el servicio.")); return; }
    setServices((current) => [result.data as Row, ...current]); setDraft(emptyDraft); setShowForm(false); setMessage("Servicio y tarifa añadidos.");
  }
  async function toggle(service: Row) {
    const id = text(service.id); setMessage(null);
    const response = await fetch(`/api/routsify/suppliers/${encodeURIComponent(supplierId)}/services/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: service.active === false }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) { setMessage(String(result?.error || "No se pudo actualizar el servicio.")); return; }
    setServices((current) => current.map((item) => text(item.id) === id ? result.data as Row : item));
  }

  return <section className="card supplier360-card supplier360-full">
    <div className="panel-head"><div><h2>Servicios y tarifas</h2><p>Catálogo interno reutilizable al preparar presupuestos y compras.</p></div>{canManage ? <button className={showForm ? "btn secondary" : "btn"} type="button" onClick={() => { setShowForm((value) => !value); setMessage(null); }}>{showForm ? "Cerrar" : "Nuevo servicio"}</button> : null}</div>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {showForm ? <form className="form supplier360-form" onSubmit={createService}>
      <div className="grid grid-3"><label>Servicio *<input className="input" required value={draft.name} onChange={(event) => update("name", event.target.value)} /></label><label>Categoría<input className="input" value={draft.category} onChange={(event) => update("category", event.target.value)} /></label><label>Destino<input className="input" value={draft.destination} onChange={(event) => update("destination", event.target.value)} /></label></div>
      <div className="grid grid-3"><label>Coste base<input className="input" type="number" min={0} step="0.01" value={draft.base_cost} onChange={(event) => update("base_cost", event.target.value)} /></label><label>Moneda<input className="input" maxLength={3} value={draft.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} /></label><label>Unidad<input className="input" value={draft.unit} onChange={(event) => update("unit", event.target.value)} placeholder="persona, noche, grupo..." /></label></div>
      <div className="grid grid-3"><label>Impuesto %<input className="input" type="number" min={0} max={100} step="0.01" value={draft.tax_rate} onChange={(event) => update("tax_rate", event.target.value)} /></label><label>Válido desde<input className="input" type="date" value={draft.valid_from} onChange={(event) => update("valid_from", event.target.value)} /></label><label>Válido hasta<input className="input" type="date" value={draft.valid_until} onChange={(event) => update("valid_until", event.target.value)} /></label></div>
      <label>Notas<textarea rows={3} value={draft.notes} onChange={(event) => update("notes", event.target.value)} /></label>
      <div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar servicio"}</button></div>
    </form> : null}
    {services.length === 0 ? <div className="empty-state"><h3>Sin servicios configurados</h3><p>Añade las tarifas habituales para reutilizarlas en la operativa.</p></div> : <div className="table-scroll"><table><thead><tr><th>Servicio</th><th>Destino</th><th>Coste</th><th>Vigencia</th><th>Estado</th></tr></thead><tbody>{services.map((service) => <tr key={text(service.id)}><td><strong>{text(service.name)}</strong><br /><small>{text(service.category) || text(service.unit) || "Servicio"}</small></td><td>{text(service.destination) || "General"}</td><td>{service.base_cost === null || service.base_cost === undefined ? "—" : money(service.base_cost, text(service.currency) || "EUR")}<br /><small>{service.tax_rate === null || service.tax_rate === undefined ? "Sin impuesto indicado" : `${Number(service.tax_rate)} %`}</small></td><td>{date(service.valid_from)} → {date(service.valid_until)}</td><td>{canManage ? <button className={`status-pill ${service.active === false ? "" : "status-done"}`} type="button" onClick={() => void toggle(service)}>{service.active === false ? "Inactivo" : "Activo"}</button> : service.active === false ? "Inactivo" : "Activo"}</td></tr>)}</tbody></table></div>}
  </section>;
}
