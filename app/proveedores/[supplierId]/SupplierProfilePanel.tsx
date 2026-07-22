"use client";

import { FormEvent, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";

type Row = Record<string, unknown>;
type Draft = {
  preferred: boolean;
  risk_level: string;
  reliability_score: number;
  average_rating: string;
  payment_terms_days: number;
  default_currency: string;
  default_margin_pct: string;
  service_regions: string;
  cancellation_policy: string;
  emergency_name: string;
  emergency_phone: string;
  emergency_email: string;
};

function text(value: unknown) { return String(value ?? "").trim(); }
function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function list(value: unknown) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function draftFromSupplier(supplier: Row): Draft {
  const emergency = object(supplier.emergency_contact);
  return {
    preferred: supplier.preferred === true,
    risk_level: text(supplier.risk_level) || "low",
    reliability_score: Number(supplier.reliability_score || 70),
    average_rating: supplier.average_rating === null || supplier.average_rating === undefined ? "" : String(supplier.average_rating),
    payment_terms_days: Number(supplier.payment_terms_days || 0),
    default_currency: text(supplier.default_currency) || "EUR",
    default_margin_pct: supplier.default_margin_pct === null || supplier.default_margin_pct === undefined ? "" : String(supplier.default_margin_pct),
    service_regions: list(supplier.service_regions).join(", "),
    cancellation_policy: text(supplier.cancellation_policy),
    emergency_name: text(emergency.name),
    emergency_phone: text(emergency.phone),
    emergency_email: text(emergency.email),
  };
}

export function SupplierProfilePanel({ supplier, onSaved }: { supplier: Row; onSaved: (supplier: Row) => void }) {
  const canManage = usePermission("suppliers.manage");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromSupplier(supplier));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supplierId = text(supplier.id);
  const emergency = object(supplier.emergency_contact);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/suppliers/${encodeURIComponent(supplierId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        preferred: draft.preferred,
        risk_level: draft.risk_level,
        reliability_score: draft.reliability_score,
        average_rating: draft.average_rating === "" ? null : Number(draft.average_rating),
        payment_terms_days: draft.payment_terms_days,
        default_currency: draft.default_currency.trim().toUpperCase(),
        default_margin_pct: draft.default_margin_pct === "" ? null : Number(draft.default_margin_pct.replace(",", ".")),
        service_regions: draft.service_regions.split(",").map((item) => item.trim()).filter(Boolean),
        cancellation_policy: draft.cancellation_policy || null,
        emergency_contact: { name: draft.emergency_name, phone: draft.emergency_phone, email: draft.emergency_email },
      }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) { setMessage(String(result?.error || "No se pudo guardar el perfil del proveedor.")); return; }
    onSaved(result.data as Row);
    setDraft(draftFromSupplier(result.data as Row));
    setEditing(false);
    setMessage("Perfil operativo actualizado.");
  }

  return <section className="card supplier360-card">
    <div className="panel-head"><div><h2>Perfil operativo</h2><p>Fiabilidad, condiciones y cobertura interna del proveedor.</p></div>{canManage ? <button className={editing ? "btn secondary" : "btn"} type="button" onClick={() => { setEditing((value) => !value); setMessage(null); }}>{editing ? "Cerrar" : "Editar perfil"}</button> : null}</div>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {editing ? <form className="form" onSubmit={save}>
      <div className="grid grid-3">
        <label>Riesgo<select value={draft.risk_level} onChange={(event) => update("risk_level", event.target.value)}><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option></select></label>
        <label>Fiabilidad 0-100<input className="input" type="number" min={0} max={100} value={draft.reliability_score} onChange={(event) => update("reliability_score", Number(event.target.value))} /></label>
        <label>Valoración 0-5<input className="input" type="number" min={0} max={5} step="0.1" value={draft.average_rating} onChange={(event) => update("average_rating", event.target.value)} /></label>
        <label>Plazo de pago (días)<input className="input" type="number" min={0} max={365} value={draft.payment_terms_days} onChange={(event) => update("payment_terms_days", Number(event.target.value))} /></label>
        <label>Moneda<input className="input" maxLength={3} value={draft.default_currency} onChange={(event) => update("default_currency", event.target.value)} /></label>
        <label>Margen predeterminado (%)<input className="input" type="number" min={0} max={99} step="0.1" value={draft.default_margin_pct} onChange={(event) => update("default_margin_pct", event.target.value)} placeholder="Usar global" /></label>
        <label>Regiones / destinos<input className="input" value={draft.service_regions} onChange={(event) => update("service_regions", event.target.value)} placeholder="Italia, Francia, París..." /></label>
      </div>
      <label><input type="checkbox" checked={draft.preferred} onChange={(event) => update("preferred", event.target.checked)} /> Proveedor preferente para nuevas propuestas</label>
      <label>Política de cancelación<textarea rows={4} value={draft.cancellation_policy} onChange={(event) => update("cancellation_policy", event.target.value)} /></label>
      <div className="grid grid-3"><label>Contacto de emergencia<input className="input" value={draft.emergency_name} onChange={(event) => update("emergency_name", event.target.value)} /></label><label>Teléfono de emergencia<input className="input" value={draft.emergency_phone} onChange={(event) => update("emergency_phone", event.target.value)} /></label><label>Email de emergencia<input className="input" type="email" value={draft.emergency_email} onChange={(event) => update("emergency_email", event.target.value)} /></label></div>
      <div className="form-actions"><button className="btn secondary" type="button" onClick={() => { setDraft(draftFromSupplier(supplier)); setEditing(false); }} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar perfil"}</button></div>
    </form> : <dl className="client360-dl">
      <div><dt>Preferente</dt><dd>{supplier.preferred ? "Sí" : "No"}</dd></div><div><dt>Riesgo</dt><dd>{text(supplier.risk_level) || "low"}</dd></div>
      <div><dt>Fiabilidad</dt><dd>{Number(supplier.reliability_score || 0)}/100</dd></div><div><dt>Valoración</dt><dd>{supplier.average_rating === null || supplier.average_rating === undefined ? "—" : `${Number(supplier.average_rating).toFixed(1)}/5`}</dd></div>
      <div><dt>Pago</dt><dd>{Number(supplier.payment_terms_days || 0)} días</dd></div><div><dt>Moneda</dt><dd>{text(supplier.default_currency) || "EUR"}</dd></div>
      <div><dt>Margen predeterminado</dt><dd>{supplier.default_margin_pct === null || supplier.default_margin_pct === undefined ? "Global" : `${Number(supplier.default_margin_pct).toFixed(1)}%`}</dd></div>
      <div><dt>Cobertura</dt><dd>{list(supplier.service_regions).join(", ") || "Sin definir"}</dd></div><div><dt>Emergencias</dt><dd>{text(emergency.name) || text(emergency.phone) || "Sin contacto"}</dd></div>
    </dl>}
    {!editing ? <div className="client360-note"><strong>Política de cancelación</strong><p>{text(supplier.cancellation_policy) || "Sin política registrada."}</p></div> : null}
  </section>;
}
