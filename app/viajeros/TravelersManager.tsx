"use client";

import { FormEvent, useMemo, useState } from "react";
import { cases } from "@/lib/mock-data";
import { demoTravelers, documentStatuses, travelerSummary, Traveler } from "@/lib/travelers";
import { isDemoMode } from "@/lib/supabase-browser";

type TravelerDraft = {
  case_code: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  document_type: string;
  document_number: string;
  document_expiry: string;
  document_file: string;
  notes: string;
};

const emptyDraft: TravelerDraft = {
  case_code: "EXP-2026-0001",
  full_name: "",
  date_of_birth: "",
  nationality: "ES",
  document_type: "passport",
  document_number: "",
  document_expiry: "",
  document_file: "",
  notes: "",
};

function inferStatus(draft: TravelerDraft): Traveler["status"] {
  if (!draft.document_number.trim() || !draft.document_expiry.trim()) return "missing";
  const expiry = new Date(draft.document_expiry);
  if (!Number.isNaN(expiry.getTime()) && expiry < new Date()) return "expired";
  return draft.document_file.trim() ? "uploaded" : "missing";
}

export function TravelersManager() {
  const [items, setItems] = useState<Traveler[]>(demoTravelers);
  const [draft, setDraft] = useState<TravelerDraft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => travelerSummary(items), [items]);

  function updateDraft<K extends keyof TravelerDraft>(key: K, value: TravelerDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addTraveler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.full_name.trim()) {
      setMessage("Añade el nombre completo del viajero.");
      return;
    }

    const item: Traveler = {
      id: `traveler-${Date.now()}`,
      case_code: draft.case_code,
      full_name: draft.full_name.trim(),
      date_of_birth: draft.date_of_birth,
      nationality: draft.nationality.trim() || "ES",
      document_type: draft.document_type,
      document_number: draft.document_number.trim(),
      document_expiry: draft.document_expiry,
      document_file: draft.document_file.trim() || undefined,
      status: inferStatus(draft),
      notes: draft.notes.trim() || undefined,
    };

    setItems((current) => [item, ...current]);
    setDraft({ ...emptyDraft, case_code: draft.case_code });
    setMessage(isDemoMode() ? "Viajero añadido en modo demo. La documentación real irá a bucket privado de Supabase." : "Viajero preparado para guardado real.");
  }

  function updateStatus(id: string, status: Traveler["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Viajeros</span><div className="metric">{summary.total}</div><p>Personas asociadas a expedientes activos.</p></div>
        <div className="card"><span className="badge">Faltan documentos</span><div className="metric">{summary.missing}</div><p>{summary.expired} documentos caducados.</p></div>
        <div className="card"><span className="badge">Estado contrato</span><div className="metric">{summary.ready ? "ready" : "blocked"}</div><p>El contrato no debería avanzar si falta documentación mínima.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Alta de viajero</div>
          <h2>Datos mínimos operativos</h2>
          <form className="form" onSubmit={addTraveler}>
            <label>Expediente
              <select value={draft.case_code} onChange={(event) => updateDraft("case_code", event.target.value)}>
                {cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}
              </select>
            </label>
            <label>Nombre completo<input className="input" value={draft.full_name} onChange={(event) => updateDraft("full_name", event.target.value)} placeholder="Nombre y apellidos" /></label>
            <div className="grid grid-3">
              <label>Nacimiento<input className="input" type="date" value={draft.date_of_birth} onChange={(event) => updateDraft("date_of_birth", event.target.value)} /></label>
              <label>Nacionalidad<input className="input" value={draft.nationality} onChange={(event) => updateDraft("nationality", event.target.value)} /></label>
              <label>Tipo documento<select value={draft.document_type} onChange={(event) => updateDraft("document_type", event.target.value)}><option value="passport">Pasaporte</option><option value="dni">DNI</option><option value="other">Otro</option></select></label>
            </div>
            <div className="grid grid-3">
              <label>Número<input className="input" value={draft.document_number} onChange={(event) => updateDraft("document_number", event.target.value)} /></label>
              <label>Caducidad<input className="input" type="date" value={draft.document_expiry} onChange={(event) => updateDraft("document_expiry", event.target.value)} /></label>
              <label>Archivo<input className="input" value={draft.document_file} onChange={(event) => updateDraft("document_file", event.target.value)} placeholder="pasaporte.pdf" /></label>
            </div>
            <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Añadir viajero</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Regla MVP</div>
          <h2>Documentación mínima</h2>
          <p>Routsify no sustituye un gestor documental completo en el MVP. Solo registra el mínimo operativo para contrato, proveedores, vuelos, hoteles y cierre.</p>
          <table>
            <tbody>
              <tr><th>Subida real</th><td>Bucket privado Supabase</td></tr>
              <tr><th>Acceso público</th><td>No permitido</td></tr>
              <tr><th>OCR</th><td>Fuera del MVP</td></tr>
              <tr><th>Revisión</th><td>Manual por operaciones</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Expediente</th><th>Viajero</th><th>Documento</th><th>Caducidad</th><th>Archivo</th><th>Estado</th><th>Notas</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.case_code}</strong></td>
                <td>{item.full_name}<br/><small>{item.date_of_birth || "sin nacimiento"} · {item.nationality}</small></td>
                <td>{item.document_type}<br/><small>{item.document_number || "sin número"}</small></td>
                <td>{item.document_expiry || "—"}</td>
                <td>{item.document_file || "—"}</td>
                <td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as Traveler["status"])}>{documentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                <td>{item.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
