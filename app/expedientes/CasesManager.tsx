"use client";

import { FormEvent, useMemo, useState } from "react";

type CaseRow = {
  id: string;
  case_code: string;
  title?: string | null;
  status?: string | null;
  destination?: string | null;
  trip_start?: string | null;
  trip_end?: string | null;
  next_action?: string | null;
  blocker?: string | null;
  accepted_value?: number | string | null;
  currency?: string | null;
  final_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  clients?: { display_name?: string | null; email?: string | null; phone?: string | null } | null;
};

type Draft = { client_name: string; destination: string; trip_start: string; trip_end: string; final_notes: string };

const emptyDraft: Draft = { client_name: "", destination: "", trip_start: "", trip_end: "", final_notes: "" };
const statuses = [
  ["new_lead", "Nuevo"],
  ["budget_draft", "Presupuesto en preparación"],
  ["proposal_sent", "Presupuesto enviado"],
  ["accepted", "Aceptado"],
  ["in_progress", "En curso"],
  ["closed", "Cerrado"],
];

function normalizeCase(input: unknown): CaseRow {
  const row = input as Record<string, unknown>;
  const code = String(row.case_code || row.code || "EXP-SIN-CODIGO");
  return {
    id: String(row.id || code),
    case_code: code,
    title: row.title ? String(row.title) : null,
    status: row.status ? String(row.status) : "new_lead",
    destination: row.destination ? String(row.destination) : null,
    trip_start: row.trip_start ? String(row.trip_start) : null,
    trip_end: row.trip_end ? String(row.trip_end) : null,
    next_action: row.next_action ? String(row.next_action) : null,
    blocker: row.blocker ? String(row.blocker) : null,
    accepted_value: typeof row.accepted_value === "number" || typeof row.accepted_value === "string" ? row.accepted_value : null,
    currency: row.currency ? String(row.currency) : "EUR",
    final_notes: row.final_notes ? String(row.final_notes) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    clients: row.clients && typeof row.clients === "object" ? row.clients as CaseRow["clients"] : null,
  };
}

function statusLabel(status?: string | null) {
  return statuses.find(([value]) => value === status)?.[1] || status || "Nuevo";
}

function money(value?: string | number | null, currency = "EUR") {
  const numeric = Number(value || 0);
  if (!numeric) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numeric);
}

function dateRange(item: CaseRow) {
  if (!item.trip_start && !item.trip_end) return "Sin fechas";
  return `${item.trip_start || "—"} → ${item.trip_end || "—"}`;
}

export function CasesManager({ initialCases = [] }: { initialCases?: unknown[] }) {
  const [items, setItems] = useState<CaseRow[]>(() => initialCases.map(normalizeCase));
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id || null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = status === "Todos" || item.status === status;
      const haystack = [item.case_code, item.title, item.destination, item.clients?.display_name, item.clients?.email, item.next_action].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [items, search, status]);

  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0] || null;
  const active = items.filter((item) => item.status !== "closed" && item.status !== "cerrado").length;
  const pending = items.filter((item) => item.next_action || item.blocker).length;
  const closed = items.filter((item) => item.status === "closed" || item.status === "cerrado").length;
  const acceptedValue = items.reduce((sum, item) => sum + Number(item.accepted_value || 0), 0);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clientName = draft.client_name.trim();
    const destination = draft.destination.trim();
    if (!clientName || !destination) {
      setMessage("Indica cliente y destino para crear el expediente.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/routsify/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, client_name: clientName, destination }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok || !result?.ok) {
      setMessage("No se pudo crear el expediente.");
      return;
    }

    const created = normalizeCase(result.data);
    setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    setSelectedId(created.id);
    setDraft(emptyDraft);
    setMessage("Expediente creado correctamente.");
  }

  async function updateStatus(id: string, nextStatus: string) {
    setSavingId(id);
    setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus, next_action: nextStatus === "closed" ? "Expediente cerrado" : "Revisar siguiente paso" }),
    });
    const result = await response.json().catch(() => null);
    setSavingId(null);

    if (!response.ok || !result?.ok) {
      setMessage("No se pudo actualizar el expediente.");
      return;
    }

    const updated = normalizeCase(result.data);
    setItems((current) => current.map((item) => item.id === id ? updated : item));
    setSelectedId(updated.id);
    setMessage("Estado actualizado correctamente.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <div className="kpi-card"><span className="kpi-icon">E</span><span className="kpi-copy"><strong>Expedientes</strong><b>{items.length}</b><small>Total registrados</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Activos</strong><b>{active}</b><small>En seguimiento</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Pendientes</strong><b>{pending}</b><small>Con próxima acción</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Vendido</strong><b>{money(acceptedValue)}</b><small>Valor aceptado</small></span></div>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="expedientes-listado">
          <div className="client-filters client-filters-simple">
            <input className="input" placeholder="Buscar expediente..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <details className="new-client-drawer">
              <summary className="btn">Nuevo expediente</summary>
              <form className="form" onSubmit={createCase}>
                <label>Cliente<input className="input" value={draft.client_name} onChange={(event) => updateDraft("client_name", event.target.value)} /></label>
                <label>Destino<input className="input" value={draft.destination} onChange={(event) => updateDraft("destination", event.target.value)} /></label>
                <div className="grid grid-2"><label>Inicio<input className="input" type="date" value={draft.trip_start} onChange={(event) => updateDraft("trip_start", event.target.value)} /></label><label>Fin<input className="input" type="date" value={draft.trip_end} onChange={(event) => updateDraft("trip_end", event.target.value)} /></label></div>
                <label>Notas<textarea className="input" rows={3} value={draft.final_notes} onChange={(event) => updateDraft("final_notes", event.target.value)} /></label>
                <button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar expediente"}</button>
              </form>
            </details>
          </div>
          {message ? <p className="client-message">{message}</p> : null}

          {items.length === 0 ? (
            <div className="empty-state"><h2>Todavía no hay expedientes</h2><p>Crea tu primer expediente para empezar a trabajar.</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><h2>No hay coincidencias</h2><p>Cambia la búsqueda o el filtro.</p></div>
          ) : (
            <table>
              <thead><tr><th>Expediente</th><th>Cliente</th><th>Destino</th><th>Fechas</th><th>Estado</th><th>Próxima acción</th></tr></thead>
              <tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(item.id)}><strong>{item.case_code}</strong></button></td><td>{item.clients?.display_name || "—"}</td><td>{item.destination || "—"}</td><td>{dateRange(item)}</td><td><select value={item.status || "new_lead"} onChange={(event) => void updateStatus(item.id, event.target.value)} disabled={savingId === item.id}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td>{item.next_action || "—"}</td></tr>)}</tbody>
            </table>
          )}
        </div>

        <aside className="client-side card">
          {selected ? (
            <>
              <div className="client-side-header"><div><h2>{selected.case_code}</h2><p><strong>{selected.clients?.display_name || "Sin cliente"}</strong><br />{selected.destination || "Sin destino"} · {dateRange(selected)}</p></div><span className="status-pill status-progress">{statusLabel(selected.status)}</span></div>
              <section className="side-section"><h3>Datos generales</h3><table><tbody><tr><th>Título</th><td>{selected.title || "—"}</td></tr><tr><th>Estado</th><td>{statusLabel(selected.status)}</td></tr><tr><th>Próxima acción</th><td>{selected.next_action || "—"}</td></tr><tr><th>Bloqueo</th><td>{selected.blocker || "Ninguno"}</td></tr></tbody></table></section>
              <section className="side-section"><h3>Cliente</h3><table><tbody><tr><th>Nombre</th><td>{selected.clients?.display_name || "—"}</td></tr><tr><th>Email</th><td>{selected.clients?.email || "—"}</td></tr><tr><th>Teléfono</th><td>{selected.clients?.phone || "—"}</td></tr></tbody></table></section>
              <section className="side-section"><h3>Notas</h3><p>{selected.final_notes || "Sin notas internas."}</p></section>
              <section className="side-actions"><h3>Acciones</h3><a className="quick-action primary" href="/propuestas">Crear presupuesto <span>→</span></a><a className="quick-action" href="/compras">Ver compras <span>→</span></a>{statuses.map(([value, label]) => <button key={value} className={value === selected.status ? "quick-action primary" : "quick-action"} type="button" onClick={() => void updateStatus(selected.id, value)} disabled={savingId === selected.id}>{label}<span>→</span></button>)}</section>
            </>
          ) : (
            <div className="empty-state"><h2>Sin expediente seleccionado</h2><p>Selecciona o crea un expediente para ver su ficha.</p></div>
          )}
        </aside>
      </section>
    </div>
  );
}
