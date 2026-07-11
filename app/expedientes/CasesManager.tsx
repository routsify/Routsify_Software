"use client";

import { FormEvent, useMemo, useState } from "react";

type ClientOption = {
  id: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
};

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

type Draft = {
  client_id: string;
  title: string;
  destination: string;
  trip_start: string;
  trip_end: string;
  final_notes: string;
};

const statusOptions = [
  { value: "new_lead", label: "Nuevo", nextAction: "Cualificar solicitud" },
  { value: "call_booked", label: "Llamada reservada", nextAction: "Preparar llamada" },
  { value: "call_done", label: "Llamada realizada", nextAction: "Preparar presupuesto" },
  { value: "budget_draft", label: "Presupuesto en preparación", nextAction: "Completar presupuesto" },
  { value: "proposal_sent", label: "Presupuesto enviado", nextAction: "Hacer seguimiento al cliente" },
  { value: "proposal_accepted", label: "Presupuesto aceptado", nextAction: "Preparar contrato" },
  { value: "contract_ready", label: "Contrato preparado", nextAction: "Enviar contrato" },
  { value: "contract_signed", label: "Contrato firmado", nextAction: "Confirmar pago" },
  { value: "payment_confirmed", label: "Pago confirmado", nextAction: "Confirmar proveedores" },
  { value: "suppliers_pending", label: "Proveedores pendientes", nextAction: "Cerrar compras pendientes" },
  { value: "ready_to_close", label: "Listo para cierre", nextAction: "Revisar cierre operativo" },
  { value: "closed", label: "Cerrado", nextAction: "Expediente cerrado" },
] as const;

const emptyDraft: Draft = { client_id: "", title: "", destination: "", trip_start: "", trip_end: "", final_notes: "" };

function normalizeClient(input: unknown): ClientOption {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || ""),
    display_name: String(row.display_name || "Cliente sin nombre"),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
  };
}

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
  return statusOptions.find((item) => item.value === status)?.label || status || "Nuevo";
}

function nextActionForStatus(status: string) {
  return statusOptions.find((item) => item.value === status)?.nextAction || "Revisar siguiente paso";
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

function validDateRange(start: string, end: string) {
  return !start || !end || start <= end;
}

export function CasesManager({ initialCases = [], initialClients = [], initialClientId = "" }: { initialCases?: unknown[]; initialClients?: unknown[]; initialClientId?: string }) {
  const [items, setItems] = useState<CaseRow[]>(() => initialCases.map(normalizeCase));
  const [clients] = useState<ClientOption[]>(() => initialClients.map(normalizeClient).filter((item) => item.id));
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id || null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft, client_id: clients.some((item) => item.id === initialClientId) ? initialClientId : "" }));
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [showCreate, setShowCreate] = useState(Boolean(initialClientId));
  const [showEdit, setShowEdit] = useState(false);
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
  const active = items.filter((item) => item.status !== "closed").length;
  const pending = items.filter((item) => item.next_action || item.blocker).length;
  const closed = items.filter((item) => item.status === "closed").length;
  const acceptedValue = items.reduce((sum, item) => sum + Number(item.accepted_value || 0), 0);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateEditDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setEditDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit() {
    if (!selected) return;
    setEditDraft({
      client_id: "",
      title: selected.title || "",
      destination: selected.destination || "",
      trip_start: selected.trip_start || "",
      trip_end: selected.trip_end || "",
      final_notes: selected.final_notes || "",
    });
    setShowEdit(true);
    setMessage(null);
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = draft.destination.trim();
    if (!draft.client_id || !destination) {
      setMessage("Selecciona un cliente e indica el destino.");
      return;
    }
    if (!validDateRange(draft.trip_start, draft.trip_end)) {
      setMessage("La fecha de fin no puede ser anterior a la fecha de inicio.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/routsify/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, destination, title: draft.title.trim() || destination }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo crear el expediente."));
      return;
    }

    const created = normalizeCase(result.data);
    setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    setSelectedId(created.id);
    setDraft(emptyDraft);
    setShowCreate(false);
    setMessage("Expediente creado correctamente.");
  }

  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (!editDraft.destination.trim()) return setMessage("Indica el destino del expediente.");
    if (!validDateRange(editDraft.trip_start, editDraft.trip_end)) return setMessage("La fecha de fin no puede ser anterior a la fecha de inicio.");

    setSavingId(selected.id);
    setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: editDraft.title.trim() || editDraft.destination.trim(),
        destination: editDraft.destination.trim(),
        trip_start: editDraft.trip_start || null,
        trip_end: editDraft.trip_end || null,
        final_notes: editDraft.final_notes.trim() || null,
      }),
    });
    const result = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo guardar el expediente."));

    const updated = normalizeCase(result.data);
    setItems((current) => current.map((item) => item.id === selected.id ? updated : item));
    setSelectedId(updated.id);
    setShowEdit(false);
    setMessage("Expediente actualizado correctamente.");
  }

  async function updateStatus(id: string, nextStatus: string) {
    setSavingId(id);
    setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus, next_action: nextActionForStatus(nextStatus) }),
    });
    const result = await response.json().catch(() => null);
    setSavingId(null);

    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo actualizar el expediente."));
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
        <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Con acción</strong><b>{pending}</b><small>Requieren seguimiento</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Vendido</strong><b>{money(acceptedValue)}</b><small>{closed} cerrados</small></span></div>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="expedientes-listado">
          <div className="client-filters client-filters-wide">
            <input className="input" placeholder="Buscar expediente, cliente o destino..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => setShowCreate((current) => !current)} aria-expanded={showCreate}>{showCreate ? "Cerrar formulario" : "Nuevo expediente"}</button>
          </div>

          {showCreate ? (
            <section className="creation-panel" aria-label="Crear nuevo expediente">
              <div className="creation-panel-header"><div><div className="eyebrow">Nuevo expediente</div><h2>Datos iniciales del viaje</h2><p>El expediente debe vincularse a un cliente existente para evitar duplicados.</p></div><button className="btn secondary" type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button></div>
              <form className="form" onSubmit={createCase}>
                <label>Cliente *<select autoFocus required value={draft.client_id} onChange={(event) => updateDraft("client_id", event.target.value)}><option value="">Selecciona un cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.display_name}{client.email ? ` · ${client.email}` : ""}</option>)}</select></label>
                {clients.length === 0 ? <p className="form-warning">No hay clientes disponibles. Crea primero un cliente.</p> : null}
                <div className="grid grid-2"><label>Título<input className="input" placeholder="Ej. Viaje a Japón en familia" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label><label>Destino *<input className="input" required value={draft.destination} onChange={(event) => updateDraft("destination", event.target.value)} /></label></div>
                <div className="grid grid-2"><label>Fecha de inicio<input className="input" type="date" value={draft.trip_start} onChange={(event) => updateDraft("trip_start", event.target.value)} /></label><label>Fecha de fin<input className="input" type="date" min={draft.trip_start || undefined} value={draft.trip_end} onChange={(event) => updateDraft("trip_end", event.target.value)} /></label></div>
                <label>Notas internas<textarea className="input" rows={3} value={draft.final_notes} onChange={(event) => updateDraft("final_notes", event.target.value)} /></label>
                <div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving || clients.length === 0}>{saving ? "Guardando..." : "Guardar expediente"}</button></div>
              </form>
            </section>
          ) : null}

          {message ? <p className="client-message" role="status">{message}</p> : null}

          {items.length === 0 ? (
            <div className="empty-state"><h2>Todavía no hay expedientes</h2><p>Crea tu primer expediente para empezar a trabajar.</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><h2>No hay coincidencias</h2><p>Cambia la búsqueda o el filtro.</p></div>
          ) : (
            <div className="table-scroll"><table>
              <thead><tr><th>Expediente</th><th>Cliente</th><th>Destino</th><th>Fechas</th><th>Estado</th><th>Próxima acción</th></tr></thead>
              <tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => { setSelectedId(item.id); setShowEdit(false); }}><strong>{item.case_code}</strong></button></td><td>{item.clients?.display_name || "—"}</td><td>{item.destination || "—"}</td><td>{dateRange(item)}</td><td><select value={item.status || "new_lead"} onChange={(event) => void updateStatus(item.id, event.target.value)} disabled={savingId === item.id}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td>{item.next_action || "—"}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>

        <aside className="client-side card">
          {selected ? (
            <>
              <div className="client-side-header compact"><div><h2>{selected.case_code}</h2><p><strong>{selected.clients?.display_name || "Sin cliente"}</strong><br />{selected.destination || "Sin destino"} · {dateRange(selected)}</p></div><span className="status-pill status-progress">{statusLabel(selected.status)}</span></div>
              {showEdit ? (
                <section className="side-section"><h3>Editar expediente</h3><form className="form" onSubmit={saveCase}><label>Título<input className="input" value={editDraft.title} onChange={(event) => updateEditDraft("title", event.target.value)} /></label><label>Destino *<input className="input" required value={editDraft.destination} onChange={(event) => updateEditDraft("destination", event.target.value)} /></label><div className="grid grid-2"><label>Inicio<input className="input" type="date" value={editDraft.trip_start} onChange={(event) => updateEditDraft("trip_start", event.target.value)} /></label><label>Fin<input className="input" type="date" min={editDraft.trip_start || undefined} value={editDraft.trip_end} onChange={(event) => updateEditDraft("trip_end", event.target.value)} /></label></div><label>Notas<textarea className="input" rows={3} value={editDraft.final_notes} onChange={(event) => updateEditDraft("final_notes", event.target.value)} /></label><div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowEdit(false)}>Cancelar</button><button className="btn" type="submit" disabled={savingId === selected.id}>{savingId === selected.id ? "Guardando..." : "Guardar"}</button></div></form></section>
              ) : (
                <>
                  <section className="side-section"><div className="section-heading"><h3>Datos generales</h3><button className="link-button" type="button" onClick={startEdit}>Editar</button></div><table><tbody><tr><th>Título</th><td>{selected.title || "—"}</td></tr><tr><th>Estado</th><td>{statusLabel(selected.status)}</td></tr><tr><th>Próxima acción</th><td>{selected.next_action || "—"}</td></tr><tr><th>Bloqueo</th><td>{selected.blocker || "Ninguno"}</td></tr></tbody></table></section>
                  <section className="side-section"><h3>Cliente</h3><table><tbody><tr><th>Nombre</th><td>{selected.clients?.display_name || "—"}</td></tr><tr><th>Email</th><td>{selected.clients?.email || "—"}</td></tr><tr><th>Teléfono</th><td>{selected.clients?.phone || "—"}</td></tr></tbody></table></section>
                  <section className="side-section"><h3>Notas</h3><p>{selected.final_notes || "Sin notas internas."}</p></section>
                  <section className="side-section"><h3>Cambiar fase</h3><select value={selected.status || "new_lead"} onChange={(event) => void updateStatus(selected.id, event.target.value)} disabled={savingId === selected.id}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></section>
                  <section className="side-actions"><h3>Acciones</h3><a className="quick-action primary" href={`/propuestas?caseId=${encodeURIComponent(selected.id)}`}>Crear o abrir presupuesto <span>→</span></a><a className="quick-action" href={`/compras?caseId=${encodeURIComponent(selected.id)}`}>Ver compras <span>→</span></a></section>
                </>
              )}
            </>
          ) : (
            <div className="empty-state"><h2>Sin expediente seleccionado</h2><p>Selecciona o crea un expediente para ver su ficha.</p></div>
          )}
        </aside>
      </section>
    </div>
  );
}
