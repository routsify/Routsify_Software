"use client";

import { FormEvent, useMemo, useState } from "react";
import { demoRequests, requestSources, requestStatuses, requestSummary, RequestItem } from "@/lib/requests";
import { isDemoMode } from "@/lib/supabase-browser";

type RequestDraft = {
  source: RequestItem["source"];
  client_name: string;
  email: string;
  phone: string;
  destination: string;
  travel_dates: string;
  travelers: string;
  budget_hint: string;
  notes: string;
};

const emptyDraft: RequestDraft = {
  source: "manual",
  client_name: "",
  email: "",
  phone: "",
  destination: "",
  travel_dates: "",
  travelers: "2",
  budget_hint: "",
  notes: "",
};

export function RequestsManager() {
  const [items, setItems] = useState<RequestItem[]>(demoRequests);
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => requestSummary(items), [items]);

  function updateDraft<K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.client_name.trim()) {
      setMessage("Añade nombre del cliente o solicitante.");
      return;
    }

    const item: RequestItem = {
      id: `request-${Date.now()}`,
      source: draft.source,
      client_name: draft.client_name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      destination: draft.destination.trim(),
      travel_dates: draft.travel_dates.trim(),
      travelers: Number(draft.travelers) || 1,
      budget_hint: draft.budget_hint.trim(),
      status: "new",
      assigned_to: "Sin asignar",
      created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
      notes: draft.notes.trim() || undefined,
    };

    setItems((current) => [item, ...current]);
    setDraft(emptyDraft);
    setMessage(isDemoMode() ? "Solicitud creada en modo demo. Luego podrá entrar automáticamente desde Fillout o Booking API." : "Solicitud creada.");
  }

  function updateStatus(id: string, status: RequestItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Solicitudes</span><div className="metric">{summary.total}</div><p>Entradas comerciales pendientes de convertir.</p></div>
        <div className="card"><span className="badge">Nuevas</span><div className="metric">{summary.fresh}</div><p>Necesitan primera revisión.</p></div>
        <div className="card"><span className="badge">Cualificadas</span><div className="metric">{summary.qualified}</div><p>Listas para llamada o expediente.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Entrada manual</div>
          <h2>Nueva solicitud</h2>
          <form className="form" onSubmit={addRequest}>
            <div className="grid grid-2">
              <label>Fuente<select value={draft.source} onChange={(event) => updateDraft("source", event.target.value as RequestItem["source"])}>{requestSources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
              <label>Nombre<input className="input" value={draft.client_name} onChange={(event) => updateDraft("client_name", event.target.value)} /></label>
            </div>
            <div className="grid grid-2">
              <label>Email<input className="input" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></label>
              <label>Teléfono<input className="input" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></label>
            </div>
            <div className="grid grid-3">
              <label>Destino<input className="input" value={draft.destination} onChange={(event) => updateDraft("destination", event.target.value)} /></label>
              <label>Fechas<input className="input" value={draft.travel_dates} onChange={(event) => updateDraft("travel_dates", event.target.value)} /></label>
              <label>Viajeros<input className="input" type="number" min="1" value={draft.travelers} onChange={(event) => updateDraft("travelers", event.target.value)} /></label>
            </div>
            <label>Presupuesto orientativo<input className="input" value={draft.budget_hint} onChange={(event) => updateDraft("budget_hint", event.target.value)} /></label>
            <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Crear solicitud</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Regla de conversión</div>
          <h2>No todo lead es expediente</h2>
          <p>La solicitud sirve para filtrar intención, destino, fechas y presupuesto. Solo se convierte en cliente/expediente cuando hay encaje real.</p>
          <table><tbody><tr><th>Entrada</th><td>Fillout, Booking API, email o manual</td></tr><tr><th>Siguiente paso</th><td>Cualificar o agendar llamada</td></tr><tr><th>Salida</th><td>Cliente + expediente</td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Fecha</th><th>Fuente</th><th>Cliente</th><th>Destino</th><th>Viajeros</th><th>Estado</th><th>Asignado</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td>{item.created_at}</td><td><span className="badge">{item.source}</span></td><td><strong>{item.client_name}</strong><br/><small>{item.email || item.phone || "sin contacto"}</small></td><td>{item.destination}<br/><small>{item.travel_dates}</small></td><td>{item.travelers}<br/><small>{item.budget_hint || "sin presupuesto"}</small></td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as RequestItem["status"])}>{requestStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{item.assigned_to}<br/><small>{item.notes || "—"}</small></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
