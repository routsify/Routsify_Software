"use client";

import { FormEvent, useMemo, useState } from "react";
import { cases as demoCases, clients, expectedPurchases } from "@/lib/mock-data";
import { caseStatuses, createCaseCode, emptyCaseDraft, CaseDraft, CaseItem } from "@/lib/cases";
import { isDemoMode } from "@/lib/supabase-browser";

export function CasesManager() {
  const [items, setItems] = useState<CaseItem[]>(demoCases as CaseItem[]);
  const [draft, setDraft] = useState<CaseDraft>(emptyCaseDraft);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.case_code, item.client, item.title, item.destination, item.status].some((value) => String(value ?? "").toLowerCase().includes(normalized)));
  }, [items, query]);

  function updateDraft<K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const title = draft.title.trim() || `${draft.destination || "Viaje"} - ${draft.client}`;
    if (!draft.client.trim() || !title.trim()) {
      setError("Selecciona cliente y añade destino o título.");
      return;
    }

    const item: CaseItem = {
      case_code: createCaseCode(items.length),
      client: draft.client,
      title,
      status: draft.status,
      destination: draft.destination,
      trip_start: draft.trip_start,
      trip_end: draft.trip_end,
      next_action: draft.next_action,
      blocker: draft.blocker,
      accepted_value: 0,
      currency: "EUR",
    };

    setItems((current) => [item, ...current]);
    setDraft({ ...emptyCaseDraft, client: draft.client });
    setMessage(isDemoMode() ? "Expediente creado en modo demo. La persistencia real se activará junto con Supabase Auth." : "Expediente preparado para guardado real.");
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">{isDemoMode() ? "Modo demo" : "Supabase real"}</div>
            <h2>{filtered.length} expedientes</h2>
            {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : <p>Estado, próxima acción, bloqueo, cliente, fechas y destino.</p>}
            {message ? <p>{message}</p> : null}
          </div>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar expediente" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </section>

      <section className="card">
        <div className="eyebrow">Nuevo expediente</div>
        <h2>Alta operativa</h2>
        <form className="form" onSubmit={createCase}>
          <div className="grid grid-3">
            <label>Cliente<select value={draft.client} onChange={(event) => updateDraft("client", event.target.value)}>{clients.map((client) => <option key={client.id} value={client.display_name}>{client.display_name}</option>)}</select></label>
            <label>Estado<select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}>{caseStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Destino<input className="input" value={draft.destination} onChange={(event) => updateDraft("destination", event.target.value)} placeholder="Japón" /></label>
          </div>
          <label>Título<input className="input" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Japón a medida - Octubre 2026" /></label>
          <div className="grid grid-3">
            <label>Inicio<input className="input" type="date" value={draft.trip_start} onChange={(event) => updateDraft("trip_start", event.target.value)} /></label>
            <label>Fin<input className="input" type="date" value={draft.trip_end} onChange={(event) => updateDraft("trip_end", event.target.value)} /></label>
            <label>Próxima acción<input className="input" value={draft.next_action} onChange={(event) => updateDraft("next_action", event.target.value)} /></label>
          </div>
          <label>Bloqueo<textarea className="input" rows={3} value={draft.blocker} onChange={(event) => updateDraft("blocker", event.target.value)} placeholder="Qué impide avanzar, si aplica" /></label>
          <button className="btn" type="submit">Crear expediente</button>
        </form>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Código</th><th>Cliente</th><th>Estado</th><th>Destino</th><th>Próxima acción</th><th>Bloqueo</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.case_code}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td>{item.client}</td><td><span className="badge">{item.status}</span></td><td>{item.destination}<br/><small>{item.trip_start || "—"} → {item.trip_end || "—"}</small></td><td>{item.next_action || "—"}</td><td>{item.blocker || "—"}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="card">
        <div className="eyebrow">Compras esperadas</div>
        <table>
          <thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Importe previsto</th></tr></thead>
          <tbody>{expectedPurchases.map((item) => <tr key={`${item.case_code}-${item.supplier}`}><td>{item.case_code}</td><td>{item.supplier}</td><td>{item.service}</td><td><span className="badge">{item.status}</span></td><td>{item.amount.toLocaleString("es-ES")} €</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
