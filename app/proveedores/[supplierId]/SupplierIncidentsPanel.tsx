"use client";

import { FormEvent, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";

type Row = Record<string, unknown>;
type CaseOption = { id: string; label: string };
type Draft = { title: string; severity: string; case_id: string; occurred_at: string; description: string };
const emptyDraft: Draft = { title: "", severity: "medium", case_id: "", occurred_at: new Date().toISOString().slice(0, 10), description: "" };

function text(value: unknown) { return String(value ?? "").trim(); }
function relation(value: unknown): Row | null { if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Row : null; return value && typeof value === "object" ? value as Row : null; }
function dateTime(value: unknown) { const raw = text(value); if (!raw) return "—"; const date = new Date(raw); return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }); }
function severityLabel(value: unknown) { return ({ low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" } as Record<string, string>)[text(value)] || text(value); }
function statusLabel(value: unknown) { return ({ open: "Abierta", monitoring: "En seguimiento", resolved: "Resuelta" } as Record<string, string>)[text(value)] || text(value); }

export function SupplierIncidentsPanel({ supplierId, initialIncidents, cases }: { supplierId: string; initialIncidents: Row[]; cases: CaseOption[] }) {
  const canManage = usePermission("suppliers.manage");
  const [incidents, setIncidents] = useState(initialIncidents);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/suppliers/${encodeURIComponent(supplierId)}/incidents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, case_id: draft.case_id || null, occurred_at: `${draft.occurred_at}T12:00:00` }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) { setMessage(String(result?.error || "No se pudo registrar la incidencia.")); return; }
    setIncidents((current) => [result.data as Row, ...current]); setDraft(emptyDraft); setShowForm(false); setMessage("Incidencia registrada y auditada.");
  }
  async function changeStatus(incident: Row, status: string) {
    const id = text(incident.id); setMessage(null);
    const response = await fetch(`/api/routsify/suppliers/${encodeURIComponent(supplierId)}/incidents/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) { setMessage(String(result?.error || "No se pudo actualizar la incidencia.")); return; }
    setIncidents((current) => current.map((item) => text(item.id) === id ? result.data as Row : item));
  }

  return <section className="card supplier360-card supplier360-full">
    <div className="panel-head"><div><h2>Incidencias y calidad</h2><p>Problemas operativos vinculados al proveedor y, cuando procede, al expediente.</p></div>{canManage ? <button className={showForm ? "btn secondary" : "btn"} type="button" onClick={() => { setShowForm((value) => !value); setMessage(null); }}>{showForm ? "Cerrar" : "Registrar incidencia"}</button> : null}</div>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {showForm ? <form className="form supplier360-form" onSubmit={createIncident}>
      <div className="grid grid-3"><label>Título *<input className="input" required value={draft.title} onChange={(event) => update("title", event.target.value)} /></label><label>Severidad<select value={draft.severity} onChange={(event) => update("severity", event.target.value)}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label>Fecha<input className="input" type="date" value={draft.occurred_at} onChange={(event) => update("occurred_at", event.target.value)} /></label></div>
      <label>Expediente relacionado<select value={draft.case_id} onChange={(event) => update("case_id", event.target.value)}><option value="">Sin expediente</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Descripción<textarea rows={4} value={draft.description} onChange={(event) => update("description", event.target.value)} /></label>
      <div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Registrar incidencia"}</button></div>
    </form> : null}
    {incidents.length === 0 ? <div className="empty-state"><h3>Sin incidencias</h3><p>No hay problemas registrados para este proveedor.</p></div> : <div className="table-scroll"><table><thead><tr><th>Incidencia</th><th>Expediente</th><th>Severidad</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{incidents.map((incident) => { const caseRow = relation(incident.cases); return <tr key={text(incident.id)}><td><strong>{text(incident.title)}</strong><br /><small>{text(incident.description) || "Sin detalle"}</small></td><td>{text(caseRow?.case_code) || "—"}<br /><small>{text(caseRow?.destination)}</small></td><td><span className={`status-pill ${["critical", "high"].includes(text(incident.severity)) ? "status-danger" : text(incident.severity) === "medium" ? "status-pending" : "status-done"}`}>{severityLabel(incident.severity)}</span></td><td>{dateTime(incident.occurred_at)}</td><td>{canManage ? <select value={text(incident.status)} onChange={(event) => void changeStatus(incident, event.target.value)}><option value="open">Abierta</option><option value="monitoring">En seguimiento</option><option value="resolved">Resuelta</option></select> : statusLabel(incident.status)}</td></tr>; })}</tbody></table></div>}
  </section>;
}
