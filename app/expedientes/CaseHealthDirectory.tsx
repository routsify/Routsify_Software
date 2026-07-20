"use client";

import { FormEvent, useState } from "react";
import type { CaseDirectoryPage, CaseDirectoryRow, CaseHealthLevel } from "@/lib/case-directory-server";

const pageSizes = [25, 50, 100, 150, 200];
const statusLabels: Record<string, string> = {
  new_lead: "Nuevo",
  call_booked: "Llamada reservada",
  call_done: "Llamada realizada",
  budget_draft: "Presupuesto en preparación",
  proposal_sent: "Presupuesto enviado",
  proposal_accepted: "Presupuesto aceptado",
  documentation_approved: "Documentación aprobada",
  contract_ready: "Contrato preparado",
  contract_signed: "Contrato firmado",
  payment_confirmed: "Pago confirmado",
  suppliers_pending: "Proveedores pendientes",
  ready_to_close: "Listo para cierre",
  closed: "Cerrado",
};
const activeStatusOptions = Object.entries(statusLabels).filter(([value]) => value !== "closed");

function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0)); }
function dateLabel(value?: string | null) { return value ? new Intl.DateTimeFormat("es-ES").format(new Date(`${value}T12:00:00`)) : "—"; }
function healthLabel(level: CaseHealthLevel) { return level === "critical" ? "Crítico" : level === "attention" ? "Atención" : "Correcto"; }
function healthClass(level: CaseHealthLevel) { return level === "critical" ? "status-danger" : level === "attention" ? "status-pending" : "status-done"; }

export function CaseHealthDirectory({ initialPage, initialCaseId = "" }: { initialPage: CaseDirectoryPage; initialCaseId?: string }) {
  const [items, setItems] = useState(initialPage.items);
  const [selectedId, setSelectedId] = useState<string | null>(() => items.some((item) => item.id === initialCaseId) ? initialCaseId : items[0]?.id || null);
  const [page, setPage] = useState(initialPage.page);
  const [pageSize, setPageSize] = useState(initialPage.pageSize);
  const [total, setTotal] = useState(initialPage.total);
  const [totalPages, setTotalPages] = useState(initialPage.totalPages);
  const [stats, setStats] = useState(initialPage.stats);
  const [queryInput, setQueryInput] = useState(initialPage.query);
  const [query, setQuery] = useState(initialPage.query);
  const [status, setStatus] = useState(initialPage.status);
  const [health, setHealth] = useState<"all" | CaseHealthLevel>(initialPage.health);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) || items[0] || null;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  async function load(nextPage: number, nextPageSize = pageSize, nextQuery = query, nextStatus = status, nextHealth = health) {
    setLoading(true); setMessage(null);
    const params = new URLSearchParams({ paginated: "1", page: String(nextPage), pageSize: String(nextPageSize), status: nextStatus, health: nextHealth });
    if (nextQuery) params.set("q", nextQuery);
    const response = await fetch(`/api/routsify/cases?${params.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok || !result?.ok) { setMessage(String(result?.error || "No se pudieron cargar los expedientes.")); return; }
    const data = result.data as CaseDirectoryPage;
    setItems(data.items); setPage(data.page); setPageSize(data.pageSize); setTotal(data.total); setTotalPages(data.totalPages); setStats(data.stats); setQuery(data.query); setStatus(data.status); setHealth(data.health);
    setSelectedId(data.items.some((item) => item.id === selectedId) ? selectedId : data.items[0]?.id || null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const next = queryInput.trim(); setQuery(next); await load(1, pageSize, next, status, health); }
  async function clear() { setQueryInput(""); setQuery(""); await load(1, pageSize, "", status, health); }

  return <div className="clients-page">
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">E</span><span className="kpi-copy"><strong>Expedientes</strong><b>{stats.total}</b><small>{stats.active} activos</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Riesgo</strong><b>{stats.critical}</b><small>{stats.attention} requieren atención</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">30</span><span className="kpi-copy"><strong>Próximos 30 días</strong><b>{stats.upcoming30}</b><small>{stats.blocked} bloqueados</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Beneficio real</strong><b>{money(stats.realProfit)}</b><small>Coste real {money(stats.realCost)}</small></span></div>
    </section>

    <section className="clients-layout">
      <div className="card clients-main">
        <form className="client-filters client-filters-wide" onSubmit={submit}>
          <input className="input" placeholder="Buscar expediente, destino, acción o bloqueo..." value={queryInput} onChange={(event) => setQueryInput(event.target.value)} />
          <label>Estado<select value={status} onChange={(event) => { setStatus(event.target.value); void load(1, pageSize, query, event.target.value, health); }} disabled={loading}><option value="active">Activos</option><option value="all">Todos</option><option value="closed">Cerrados</option>{activeStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Salud<select value={health} onChange={(event) => { const next = event.target.value as "all" | CaseHealthLevel; setHealth(next); void load(1, pageSize, query, status, next); }} disabled={loading}><option value="all">Todas</option><option value="critical">Críticos</option><option value="attention">Atención</option><option value="good">Correctos</option></select></label>
          <button className="btn secondary" type="submit" disabled={loading}>{loading ? "Calculando..." : "Buscar"}</button>
          {query ? <button className="btn secondary" type="button" onClick={() => void clear()} disabled={loading}>Limpiar</button> : null}
        </form>
        <div className="form-actions"><label>Mostrar <select value={pageSize} onChange={(event) => void load(1, Number(event.target.value))} disabled={loading}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select> expedientes</label><a className="btn" href="/clientes">Crear desde un cliente</a></div>
        {message ? <p className="client-message" role="status">{message}</p> : null}
        {loading ? <p className="client-message">Recalculando salud operativa...</p> : null}
        {items.length === 0 ? <div className="empty-state"><h2>No hay expedientes con estos filtros</h2><p>Cambia el estado, la salud o la búsqueda.</p></div> : <CaseTable items={items} selectedId={selected?.id || null} onSelect={setSelectedId} />}
        <div className="form-actions"><span>Mostrando {rangeStart}-{rangeEnd} de {total}</span><button className="btn secondary" type="button" onClick={() => void load(1)} disabled={loading || page <= 1}>Primera</button><button className="btn secondary" type="button" onClick={() => void load(page - 1)} disabled={loading || page <= 1}>Anterior</button><strong>Página {page} de {totalPages}</strong><button className="btn secondary" type="button" onClick={() => void load(page + 1)} disabled={loading || page >= totalPages}>Siguiente</button><button className="btn secondary" type="button" onClick={() => void load(totalPages)} disabled={loading || page >= totalPages}>Última</button></div>
      </div>
      <CaseHealthPanel item={selected} />
    </section>
  </div>;
}

function CaseTable({ items, selectedId, onSelect }: { items: CaseDirectoryRow[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>Salud</th><th>Expediente</th><th>Viaje</th><th>Siguiente acción</th><th>Operativa</th><th>Finanzas</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={item.id === selectedId ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => onSelect(item.id)}><span className={`status-pill ${healthClass(item.health_level)}`}>{healthLabel(item.health_level)} · {item.health_score}</span></button></td><td><button className="table-link" type="button" onClick={() => onSelect(item.id)}><strong>{item.case_code}</strong><br /><small>{item.clients?.display_name || item.title || "Sin cliente"}</small></button></td><td>{item.destination || "—"}<br /><small>{dateLabel(item.trip_start)} → {dateLabel(item.trip_end)}{item.days_to_trip !== null ? ` · ${item.days_to_trip >= 0 ? `faltan ${item.days_to_trip} días` : `hace ${Math.abs(item.days_to_trip)} días`}` : ""}</small></td><td>{item.next_action || "Sin acción"}<br /><small>{statusLabels[item.status] || item.status}</small></td><td>{item.pending_purchases} compras · {item.overdue_tasks} tareas vencidas<br /><small>{item.travelers_pending} viajeros · {item.documents_pending} documentos</small></td><td>{money(item.real_profit, item.currency)} beneficio<br /><small>{item.margin_pct.toFixed(1)} % margen · {money(item.payment_pending, item.currency)} por cobrar</small></td></tr>)}</tbody></table></div>;
}

function CaseHealthPanel({ item }: { item: CaseDirectoryRow | null }) {
  if (!item) return <aside className="client-side card"><div className="empty-state"><h2>Sin expediente seleccionado</h2><p>Selecciona un expediente para revisar su salud.</p></div></aside>;
  return <aside className="client-side card"><div className="client-side-header"><span className="client-avatar">{item.health_score}</span><div><h2>{item.case_code}</h2><p>{item.clients?.display_name || item.title || "Expediente"}<br />{item.destination || "Sin destino"}</p></div></div><div className="client-badges"><span className={`status-pill ${healthClass(item.health_level)}`}>{healthLabel(item.health_level)}</span><span className="badge">{statusLabels[item.status] || item.status}</span></div><section className="side-section"><h3>Diagnóstico operativo</h3>{item.health_issues.length ? <ul>{item.health_issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>No hay bloqueos importantes detectados.</p>}</section><section className="side-section"><h3>Situación del viaje</h3><table><tbody><tr><th>Fechas</th><td>{dateLabel(item.trip_start)} → {dateLabel(item.trip_end)}</td></tr><tr><th>Contrato</th><td>{item.contract_status === "signed" ? "Firmado" : item.contract_status === "missing" ? "No creado" : item.contract_status}</td></tr><tr><th>Compras pendientes</th><td>{item.pending_purchases}</td></tr><tr><th>Tareas abiertas</th><td>{item.open_tasks} ({item.overdue_tasks} vencidas)</td></tr><tr><th>Viajeros pendientes</th><td>{item.travelers_pending} de {item.traveler_count}</td></tr><tr><th>Documentos pendientes</th><td>{item.documents_pending}</td></tr></tbody></table></section><section className="side-section"><h3>Salud económica</h3><table><tbody><tr><th>Venta aceptada</th><td>{money(item.accepted_value, item.currency)}</td></tr><tr><th>Cobrado</th><td>{money(item.paid_total, item.currency)}</td></tr><tr><th>Pendiente</th><td>{money(item.payment_pending, item.currency)}</td></tr><tr><th>Coste presupuestado</th><td>{money(item.budgeted_cost, item.currency)}</td></tr><tr><th>Coste real</th><td>{money(item.real_cost, item.currency)}</td></tr><tr><th>Beneficio real</th><td>{money(item.real_profit, item.currency)}</td></tr><tr><th>Margen real</th><td>{item.margin_pct.toFixed(1)} %</td></tr></tbody></table></section><section className="side-actions"><h3>Acciones</h3><a className="quick-action primary" href={`/propuestas?caseId=${encodeURIComponent(item.id)}`}>Abrir presupuesto <span>→</span></a><a className="quick-action" href={`/compras?caseId=${encodeURIComponent(item.id)}`}>Revisar compras <span>→</span></a><a className="quick-action" href={`/cierre/${encodeURIComponent(item.id)}`}>Revisar cierre <span>→</span></a></section></aside>;
}
