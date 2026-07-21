"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Traveler } from "./workspace-types";
import { formatDate } from "./workspace-types";

const reviewOptions = [["pending", "Pendiente"], ["reviewed", "Revisado"], ["approved", "Aprobado"], ["rejected", "Rechazado"]];
const emptyDraft = { traveler_type: "adult", first_name: "", last_name: "", birth_date: "", nationality: "", document_country: "", document_number: "", document_expires_at: "" };

export function TravelersTab({ caseId, initialTravelers, onChange }: { caseId: string; initialTravelers: Traveler[]; onChange?: (travelers: Traveler[]) => void }) {
  const [items, setItems] = useState(initialTravelers);
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(initialTravelers); }, [initialTravelers]);

  async function createTraveler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/cases/${caseId}/travelers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo añadir el viajero."));
    setItems((current) => { const next = [...current, result.data]; onChange?.(next); return next; }); setDraft(emptyDraft); setMessage("Viajero añadido correctamente.");
  }

  async function updateStatus(item: Traveler, reviewStatus: string) {
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/cases/${caseId}/travelers`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, review_status: reviewStatus }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar el viajero."));
    setItems((current) => { const next = current.map((traveler) => traveler.id === item.id ? result.data : traveler); onChange?.(next); return next; }); setMessage("Estado actualizado.");
  }

  return <section className="workspace-grid">
    <div className="card"><h2>Añadir viajero</h2><form className="form" onSubmit={createTraveler}><div className="grid grid-2"><label>Nombre *<input className="input" required value={draft.first_name} onChange={(event) => setDraft((current) => ({ ...current, first_name: event.target.value }))} /></label><label>Apellidos *<input className="input" required value={draft.last_name} onChange={(event) => setDraft((current) => ({ ...current, last_name: event.target.value }))} /></label></div><div className="grid grid-2"><label>Tipo<select value={draft.traveler_type} onChange={(event) => setDraft((current) => ({ ...current, traveler_type: event.target.value }))}><option value="adult">Adulto</option><option value="child">Niño</option><option value="infant">Bebé</option></select></label><label>Fecha de nacimiento<input className="input" type="date" value={draft.birth_date} onChange={(event) => setDraft((current) => ({ ...current, birth_date: event.target.value }))} /></label></div><div className="grid grid-2"><label>Nacionalidad<input className="input" value={draft.nationality} onChange={(event) => setDraft((current) => ({ ...current, nationality: event.target.value }))} /></label><label>País del documento<input className="input" maxLength={2} value={draft.document_country} onChange={(event) => setDraft((current) => ({ ...current, document_country: event.target.value }))} /></label></div><div className="grid grid-2"><label>Número de documento<input className="input" value={draft.document_number} onChange={(event) => setDraft((current) => ({ ...current, document_number: event.target.value }))} /></label><label>Caducidad<input className="input" type="date" value={draft.document_expires_at} onChange={(event) => setDraft((current) => ({ ...current, document_expires_at: event.target.value }))} /></label></div><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Añadir viajero"}</button></form>{message ? <p className="client-message">{message}</p> : null}</div>
    <div className="card workspace-wide"><h2>Viajeros del expediente</h2>{items.length ? <div className="table-scroll"><table><thead><tr><th>Viajero</th><th>Tipo</th><th>Nacimiento</th><th>Documento</th><th>Caducidad</th><th>Revisión</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.first_name} {item.last_name}</strong><br/><small>{item.nationality || "Nacionalidad pendiente"}</small></td><td>{item.traveler_type || "adult"}</td><td>{formatDate(item.birth_date)}</td><td>{item.document_number || "Pendiente"}</td><td>{formatDate(item.document_expires_at)}</td><td><select value={item.review_status || "pending"} onChange={(event) => void updateStatus(item, event.target.value)} disabled={saving}>{reviewOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table></div> : <p>No hay viajeros.</p>}</div>
  </section>;
}
