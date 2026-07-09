"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CreateExpedienteInput,
  Expediente,
  buildExpedienteFlow,
  canCloseCase,
  caseBlockers,
  createDemoExpediente,
  demoExpedientes,
  expedienteKpis,
  expedienteOwners,
  expedientePriorities,
  expedienteStatuses,
  filterExpedientes,
  formatCaseMoney,
  formatCasePercent,
  getCaseTimeline,
  statusConfig,
} from "@/lib/case-master";

const emptyDraft: CreateExpedienteInput = {
  clientName: "",
  destination: "",
  startDate: "",
  endDate: "",
  travelersCount: 2,
  responsibleName: "Laura Pérez",
  priority: "media",
  internalNotes: "",
};

function formatDates(item: Expediente) {
  if (!item.startDate && !item.endDate) return "Sin fechas";
  return `${item.startDate || "—"} → ${item.endDate || "—"}`;
}

function flowLabel(status: string) {
  if (status === "completed") return "Completado";
  if (status === "in_progress") return "En curso";
  if (status === "blocked") return "Bloqueado";
  return "Pendiente";
}

function toneClass(tone: string) {
  if (tone === "green") return "status-progress";
  if (tone === "amber") return "priority-normal";
  if (tone === "purple") return "status-pending";
  if (tone === "blue") return "status-progress";
  return "status-pill";
}

export function CasesManager() {
  const [items, setItems] = useState<Expediente[]>(demoExpedientes);
  const [selectedId, setSelectedId] = useState(demoExpedientes[0].id);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [owner, setOwner] = useState("Todos");
  const [priority, setPriority] = useState("Todos");
  const [draft, setDraft] = useState<CreateExpedienteInput>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);

  const kpis = useMemo(() => expedienteKpis(items), [items]);
  const filtered = useMemo(() => filterExpedientes(items, { search, status, owner, priority }), [items, search, status, owner, priority]);
  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0];
  const selectedFlow = useMemo(() => buildExpedienteFlow(selected), [selected]);
  const selectedTimeline = useMemo(() => getCaseTimeline(selected), [selected]);
  const selectedBlockers = useMemo(() => caseBlockers(selected), [selected]);

  function updateDraft<K extends keyof CreateExpedienteInput>(key: K, value: CreateExpedienteInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.clientName.trim() || !draft.destination.trim()) {
      setMessage("Para crear expediente hacen falta cliente y destino.");
      return;
    }
    const result = createDemoExpediente(draft, items);
    setItems((current) => [result.expediente, ...current]);
    setSelectedId(result.expediente.id);
    setDraft(emptyDraft);
    setMessage(`Expediente ${result.expediente.code} creado en modo demo. Timeline y auditoría quedan simulados.`);
  }

  function updateSelected<K extends keyof Expediente>(key: K, value: Expediente[K]) {
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, [key]: value, updatedAt: "Ahora", lastActivityAt: "Ahora" } : item));
    setMessage(`Cambio demo guardado: ${String(key)}. En real generará timeline y auditoría.`);
  }

  function changeStatus(nextStatus: Expediente["status"]) {
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, status: nextStatus, nextAction: statusConfig[nextStatus].nextAction, updatedAt: "Ahora", lastActivityAt: "Ahora" } : item));
    setMessage(`Estado cambiado a ${statusConfig[nextStatus].label}. Próxima acción recalculada.`);
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <a className="kpi-card" href="#expedientes-listado"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Expedientes activos</strong><b>{kpis.activeCases}</b><small>+12 vs. mes anterior ↑</small></span></a>
        <a className="kpi-card" href="#expedientes-listado"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Pendientes de acción</strong><b>{kpis.pendingActionCases}</b><small>Requieren atención</small></span></a>
        <a className="kpi-card" href="/compras"><span className="kpi-icon">👥</span><span className="kpi-copy"><strong>Proveedores pendientes</strong><b>{kpis.supplierPendingCases}</b><small>A la espera de respuesta</small></span></a>
        <a className="kpi-card" href="/propuestas"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Valor aceptado</strong><b>{formatCaseMoney(kpis.acceptedValueTotal)}</b><small>Presupuestos aceptados ↑</small></span></a>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="expedientes-listado">
          <div className="client-filters">
            <input className="input" placeholder="Buscar expediente..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{expedienteStatuses.map((item) => <option key={item} value={item}>{statusConfig[item].label}</option>)}</select></label>
            <label>Responsable<select value={owner} onChange={(event) => setOwner(event.target.value)}><option>Todos</option>{expedienteOwners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value)}><option>Todos</option>{expedientePriorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <details className="new-client-drawer">
              <summary className="btn">+ Nuevo expediente</summary>
              <form className="form" onSubmit={createCase}>
                <label>Cliente<input className="input" value={draft.clientName} onChange={(event) => updateDraft("clientName", event.target.value)} placeholder="Juan Pérez" /></label>
                <label>Destino<input className="input" value={draft.destination} onChange={(event) => updateDraft("destination", event.target.value)} placeholder="Japón" /></label>
                <div className="grid grid-2"><label>Inicio<input className="input" type="date" value={draft.startDate} onChange={(event) => updateDraft("startDate", event.target.value)} /></label><label>Fin<input className="input" type="date" value={draft.endDate} onChange={(event) => updateDraft("endDate", event.target.value)} /></label></div>
                <div className="grid grid-2"><label>Viajeros<input className="input" type="number" min="1" value={draft.travelersCount} onChange={(event) => updateDraft("travelersCount", Number(event.target.value))} /></label><label>Responsable<select value={draft.responsibleName} onChange={(event) => updateDraft("responsibleName", event.target.value)}>{expedienteOwners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
                <label>Prioridad<select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value as Expediente["priority"])}>{expedientePriorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label>Notas internas<textarea className="input" rows={3} value={draft.internalNotes} onChange={(event) => updateDraft("internalNotes", event.target.value)} /></label>
                <button className="btn" type="submit">Crear expediente</button>
              </form>
            </details>
          </div>
          {message ? <p className="client-message">{message}</p> : null}

          <table>
            <thead><tr><th>Expediente</th><th>Cliente</th><th>Destino</th><th>Estado</th><th>Próxima acción</th><th>Responsable</th><th>Última actividad</th><th></th></tr></thead>
            <tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selected.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(item.id)}><strong>{item.code}</strong></button></td><td>{item.clientName}</td><td>{item.destination}</td><td><span className={`status-pill ${toneClass(statusConfig[item.status].tone)}`}>{statusConfig[item.status].label}</span></td><td>{item.nextAction}</td><td>{item.responsibleName}</td><td>{item.lastActivityAt}</td><td><details><summary className="icon-button">⋮</summary><div className="card" style={{ position: "absolute", right: 24, zIndex: 10 }}><a href={`/expedientes/${item.code}`}>Ver expediente</a><br/><button className="table-link" type="button" onClick={() => setSelectedId(item.id)}>Ver timeline</button><br/><a href="/propuestas">Abrir presupuesto</a><br/><a href="/compras">Ver compras</a><br/><button className="table-link" type="button" onClick={() => updateSelected("priority", item.priority === "alta" ? "media" : "alta")}>Cambiar prioridad</button></div></details></td></tr>)}</tbody>
          </table>
          <div className="table-pagination"><span>Mostrando 1 a {filtered.length} de {items.length} expedientes</span><span><button className="btn secondary">‹</button><button className="btn">1</button><button className="btn secondary">2</button><button className="btn secondary">3</button><button className="btn secondary">›</button></span></div>
        </div>

        <aside className="client-side card">
          <div className="client-side-header"><div><h2>{selected.code}</h2><p><strong>{selected.clientName}</strong> · {selected.destination}<br/>{formatDates(selected)}</p></div><span className={`status-pill ${toneClass(statusConfig[selected.status].tone)}`}>{statusConfig[selected.status].label}</span></div>
          <section className="side-section"><h3>Situación rápida</h3><table><tbody><tr><th>Próxima acción</th><td>{selected.nextAction}</td></tr><tr><th>Bloqueo</th><td>{selected.blocker || "Ninguno"}</td></tr><tr><th>Responsable</th><td>{selected.responsibleName}</td></tr><tr><th>Prioridad</th><td><span className={`status-pill priority-${selected.priority === "alta" ? "high" : selected.priority === "media" ? "normal" : "low"}`}>{selected.priority}</span></td></tr></tbody></table></section>
          <section className="side-section"><h3>Resumen</h3><table><tbody><tr><th>Viajeros</th><td>{selected.travelersSummary}</td></tr><tr><th>Valor aceptado</th><td>{formatCaseMoney(selected.acceptedValue)}</td></tr><tr><th>Margen previsto</th><td>{formatCasePercent(selected.estimatedMarginPct)}</td></tr><tr><th>Cierre</th><td>{canCloseCase(selected) ? "Permitido" : "Bloqueado"}</td></tr></tbody></table></section>
          <section className="side-section"><h3>Timeline <a href={`/api/routsify/cases/${selected.code}/timeline`}>Ver API</a></h3><div className="timeline">{selectedTimeline.map((event) => <div key={event.id}><strong>{event.createdAt} · {event.title}</strong><p>{event.userName}</p></div>)}</div></section>
          <section className="side-section"><h3>Estado del flujo</h3>{selectedFlow.slice(0, 5).map((step) => <p key={step.key}><span className={`status-pill ${step.status === "completed" ? "status-progress" : step.status === "in_progress" ? "priority-normal" : step.status === "blocked" ? "priority-urgent" : ""}`}>{flowLabel(step.status)}</span> <strong>{step.label}</strong></p>)}</section>
          <section className="side-section"><h3>Bloqueos</h3>{selectedBlockers.length ? selectedBlockers.map((blocker) => <p key={blocker} className="danger-text">⚠ {blocker}</p>) : <p>Sin bloqueos. Puede avanzar.</p>}</section>
          <section className="side-actions"><h3>Acciones rápidas</h3><a className="quick-action" href={`/expedientes/${selected.code}`}>Ver expediente completo <span>→</span></a><a className="quick-action" href="/propuestas">{selected.budgetId ? "Abrir presupuesto" : "Crear presupuesto"} <span>→</span></a><a className="quick-action" href="/compras">Ver compras <span>→</span></a><button className="quick-action primary" type="button" onClick={() => selectedFlow.find((step) => step.key === "contract")?.status === "pending" ? setMessage("No puedes generar contrato si falta documentación aprobada, precio aceptado o cliente vinculado.") : setMessage("Contrato generado en demo con preflight revisado.")}>Generar contrato <span>→</span></button><button className="quick-action" type="button" onClick={() => canCloseCase(selected) ? changeStatus("cerrado") : setMessage("No se puede cerrar: revisa contrato, pago, Holded o compras pendientes.")}>Cerrar expediente <span>→</span></button></section>
          <div className="client-footnote">El expediente es la unidad central de trabajo. Toda la información y actividad se gestiona aquí.</div>
        </aside>
      </section>
    </div>
  );
}
