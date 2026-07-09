"use client";

import { useMemo, useState } from "react";
import { budgetRows, clientRows, destinations, filters, funnelSteps, money, painPoints, percent, profitabilityRows, reportTabs, supplierRows, summaryMetrics, teamRows, timeSeries, timingMetrics, type ReportTabLabel } from "@/lib/report-decision";

function severityClass(severity: string) {
  if (severity === "high") return "priority-urgent";
  if (severity === "medium") return "priority-normal";
  return "priority-low";
}

function timingClass(status: string) {
  if (status === "good") return "status-progress";
  if (status === "warning") return "priority-normal";
  return "priority-urgent";
}

export function ReportsManager() {
  const [activeTab, setActiveTab] = useState<ReportTabLabel>("Resumen ejecutivo");
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-31");
  const [compare, setCompare] = useState("Mes anterior");
  const [responsible, setResponsible] = useState("Todos");
  const [origin, setOrigin] = useState("Todos");
  const [destination, setDestination] = useState("Todos");
  const [caseStatus, setCaseStatus] = useState("Todos");
  const [provider, setProvider] = useState("Todos");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const summary = useMemo(() => summaryMetrics(), []);
  const series = useMemo(() => timeSeries(), []);
  const funnel = useMemo(() => funnelSteps(), []);
  const destinationRows = useMemo(() => destinations(), []);
  const timing = useMemo(() => timingMetrics(), []);
  const pains = useMemo(() => painPoints(), []);
  const profit = useMemo(() => profitabilityRows(), []);
  const suppliers = useMemo(() => supplierRows(), []);
  const clients = useMemo(() => clientRows(), []);
  const budgets = useMemo(() => budgetRows(), []);
  const team = useMemo(() => teamRows(), []);

  const shareUrl = `/informes?from=${from}&to=${to}&responsible=${responsible}&origin=${origin}&destination=${destination}&caseStatus=${caseStatus}`;

  return (
    <div className="reports-page">
      <div className="reports-toolbar">
        <div className="reports-tabs">{reportTabs.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} type="button" onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
        <div className="reports-actions"><a className="btn secondary" href={shareUrl}>Compartir filtros</a><button className="btn" type="button">Exportar</button></div>
      </div>

      <section className="report-filters card">
        <label>Fecha inicio<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Fecha fin<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label>Comparar con<select value={compare} onChange={(event) => setCompare(event.target.value)}>{["Mes anterior", "Periodo anterior", "Año anterior", "Sin comparación"].map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Responsable<select value={responsible} onChange={(event) => setResponsible(event.target.value)}>{filters.responsible.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Origen del lead<select value={origin} onChange={(event) => setOrigin(event.target.value)}>{filters.origin.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Destino<select value={destination} onChange={(event) => setDestination(event.target.value)}>{filters.destination.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Estado expediente<select value={caseStatus} onChange={(event) => setCaseStatus(event.target.value)}>{filters.caseStatus.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Proveedor<select value={provider} onChange={(event) => setProvider(event.target.value)}>{filters.provider.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Solo incidencias<select value={onlyIssues ? "Sí" : "No"} onChange={(event) => setOnlyIssues(event.target.value === "Sí")}><option>No</option><option>Sí</option></select></label>
      </section>

      <section className="client-kpis reports-kpis">
        <a className="kpi-card" href="/propuestas?status=accepted"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Valor aceptado</strong><b>{money(summary.acceptedValue)}</b><small>+18,6% vs {compare.toLowerCase()}</small></span></a>
        <a className="kpi-card" href="/contratos?payment=confirmed"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Ingresos confirmados</strong><b>{money(summary.confirmedRevenue)}</b><small>+12,2% vs periodo</small></span></a>
        <a className="kpi-card" href="/informes"><span className="kpi-icon">%</span><span className="kpi-copy"><strong>Margen medio</strong><b>{percent(summary.averageMarginPct)}</b><small>Real {percent(summary.realMarginPct)}</small></span></a>
        <a className="kpi-card" href="/informes"><span className="kpi-icon">◎</span><span className="kpi-copy"><strong>Beneficio estimado</strong><b>{money(summary.estimatedProfit)}</b><small>Real {money(summary.realProfit)}</small></span></a>
        <a className="kpi-card" href="/expedientes"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Expedientes activos</strong><b>{summary.activeCases}</b><small>+12 vs mes anterior</small></span></a>
        <a className="kpi-card" href="/hoy"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Tareas pendientes</strong><b>{summary.pendingTasks}</b><small>-6 vs mes anterior</small></span></a>
      </section>

      {activeTab === "Resumen ejecutivo" ? <section className="reports-grid">
        <section className="card report-card"><div className="panel-head"><h2>Evolución del valor aceptado</h2><select><option>Diario</option><option>Semanal</option><option>Mensual</option></select></div><div className="line-chart-demo">{series.map((point) => <a key={point.date} href={`/propuestas?acceptedAt=${point.date}`} style={{ height: `${Math.max(18, point.acceptedValue / 2800)}px` }}><span>{point.date}</span></a>)}</div></section>
        <section className="card report-card"><h2>Embudo de conversión</h2><table><tbody>{funnel.map((step) => <tr key={step.key}><th><a href={step.url}>{step.label}</a></th><td><div className="progress-track"><span style={{ width: `${step.conversionFromLeadPct}%` }} /></div></td><td>{step.count}</td><td>{percent(step.conversionFromPreviousPct)}</td></tr>)}</tbody></table><p><strong>Ratio final Leads → Pagos:</strong> {percent(funnel.at(-1)?.conversionFromLeadPct || 0)}</p></section>
        <section className="card report-card"><h2>Valor aceptado por destino</h2><div className="donut-list">{destinationRows.map((item) => <a key={item.destination} href={`/expedientes?destination=${item.destination}`}><strong>{item.destination}</strong><span>{money(item.value)} · {percent(item.sharePct)} · margen {percent(item.realMarginPct)}</span></a>)}</div></section>
        <section className="card report-card"><h2>Tiempo medio por etapa</h2><table><tbody>{timing.slice(0, 5).map((item) => <tr key={item.key}><td><a href={item.url}>{item.label}</a></td><td><div className="progress-track"><span style={{ width: `${Math.min(100, item.averageDays * 12)}%` }} /></div></td><td>{item.averageDays} días</td><td><span className={`status-pill ${timingClass(item.status)}`}>{item.status}</span></td></tr>)}</tbody></table></section>
        <section className="card report-card"><h2>Tiempos clave</h2><div className="mini-kpis">{timing.filter((item) => ["call_to_budget", "budget_to_sent", "sent_to_accepted", "cycle_total"].includes(item.key)).map((item) => <a key={item.key} className={`mini-kpi ${item.status}`} href={item.url}><strong>{item.averageDays} días</strong><span>{item.label}</span><small>Objetivo {item.targetDays} días · P90 {item.p90Days}</small></a>)}</div></section>
        <section className="card report-card"><h2>Top puntos de dolor</h2><table><tbody>{pains.map((point) => <tr key={point.key}><td><a href={point.url}>{point.title}</a></td><td>{point.count}</td><td>{point.economicImpact ? money(point.economicImpact) : "—"}</td><td><span className={`status-pill ${severityClass(point.severity)}`}>{point.severity}</span></td><td><a href={point.url}>{point.actionLabel}</a></td></tr>)}</tbody></table></section>
      </section> : null}

      {activeTab === "Económicos" ? <section className="reports-grid"><section className="card report-card"><h2>KPIs económicos</h2><table><tbody><tr><th>Valor presupuestado</th><td>{money(summary.acceptedValue + 80000)}</td></tr><tr><th>Valor aceptado</th><td>{money(summary.acceptedValue)}</td></tr><tr><th>Ingresos confirmados</th><td>{money(summary.confirmedRevenue)}</td></tr><tr><th>Pendiente de cobro</th><td>{money(summary.pendingCollection)}</td></tr><tr><th>Coste presupuestado</th><td>{money(summary.budgetedCost)}</td></tr><tr><th>Coste real aprobado</th><td>{money(summary.realCost)}</td></tr><tr><th>Desviación coste</th><td>{money(summary.costDeviation)}</td></tr></tbody></table></section><section className="card report-card"><h2>Ingresos vs costes vs beneficio</h2><table><thead><tr><th>Fecha</th><th>Ingresos</th><th>Beneficio previsto</th><th>Beneficio real</th></tr></thead><tbody>{series.map((point) => <tr key={point.date}><td>{point.date}</td><td>{money(point.confirmedRevenue)}</td><td>{money(point.estimatedProfit)}</td><td>{money(point.realProfit)}</td></tr>)}</tbody></table></section></section> : null}
      {activeTab === "Presupuestos" ? <section className="card report-card"><h2>Eficiencia de presupuestos</h2><table><thead><tr><th>Presupuesto</th><th>Cliente</th><th>Estado</th><th>Responsable</th><th>Venta</th><th>Margen</th><th>T. crear</th><th>Acción</th></tr></thead><tbody>{budgets.map((row) => <tr key={row.code}><td><a href="/propuestas">{row.code}</a></td><td>{row.clientName}</td><td>{row.status}</td><td>{row.responsibleName}</td><td>{money(row.totalSalePrice)}</td><td>{percent(row.marginPct)}</td><td>{row.createdDays} días</td><td><a href="/propuestas">Abrir</a></td></tr>)}</tbody></table></section> : null}
      {activeTab === "Clientes" ? <section className="card report-card"><h2>Clientes únicos y conversión</h2><table><thead><tr><th>Cliente</th><th>Origen</th><th>Expedientes</th><th>Valor aceptado</th><th>Ticket medio</th><th>Fiscalidad</th><th>Duplicado</th></tr></thead><tbody>{clients.map((row) => <tr key={row.clientId}><td><a href="/clientes">{row.clientName}</a></td><td>{row.origin}</td><td>{row.activeCases}</td><td>{money(row.acceptedValue)}</td><td>{money(row.ticketAvg)}</td><td>{row.fiscalValidated ? "Completa" : "Pendiente"}</td><td>{row.duplicateStatus}</td></tr>)}</tbody></table></section> : null}
      {activeTab === "Tiempos y productividad" ? <section className="reports-grid"><section className="card report-card"><h2>Métricas de tiempo</h2><table><tbody>{timing.map((row) => <tr key={row.key}><td><a href={row.url}>{row.label}</a></td><td>{row.averageDays} días</td><td>Mediana {row.medianDays}</td><td>P90 {row.p90Days}</td><td>{row.affectedCases} casos</td><td><span className={`status-pill ${timingClass(row.status)}`}>{row.status}</span></td></tr>)}</tbody></table></section><section className="card report-card"><h2>Equipo y cuellos de botella</h2><table><tbody>{team.map((row) => <tr key={row.userId}><td>{row.userName}</td><td>{row.activeCases} expedientes</td><td>{row.overdueTasks} vencidas</td><td>{row.blockers} bloqueos</td><td>{row.averageBudgetCreationDays} días crear presupuesto</td></tr>)}</tbody></table></section></section> : null}
      {activeTab === "Proveedores" ? <section className="card report-card"><h2>Proveedores que bloquean cierre</h2><table><thead><tr><th>Proveedor</th><th>Esperadas</th><th>Recibidas</th><th>Pendientes</th><th>Incidencias</th><th>Valor pendiente</th><th>Desviación</th><th>Bloqueos</th></tr></thead><tbody>{suppliers.map((row) => <tr key={row.providerName}><td><a href={`/compras?provider=${row.providerName}`}>{row.providerName}</a></td><td>{row.expected}</td><td>{row.received}</td><td>{row.pending}</td><td>{row.incidents}</td><td>{money(row.pendingValue)}</td><td>{money(row.costDeviation)}</td><td>{row.blockedCases}</td></tr>)}</tbody></table></section> : null}
      {activeTab === "Rentabilidad" ? <section className="card report-card"><h2>Rentabilidad por expediente</h2><table><thead><tr><th>Expediente</th><th>Cliente</th><th>Destino</th><th>Venta</th><th>Coste previsto</th><th>Coste real</th><th>Margen real</th><th>Desviación</th><th>Estado</th></tr></thead><tbody>{profit.map((row) => <tr key={row.caseCode}><td><a href={`/expedientes/${row.caseCode}`}>{row.caseCode}</a></td><td>{row.clientName}</td><td>{row.destination}</td><td>{money(row.salePrice)}</td><td>{money(row.budgetedCost)}</td><td>{money(row.realCost)}</td><td>{percent(row.realMarginPct)}</td><td>{money(row.costDeviation)}</td><td>{row.status}</td></tr>)}</tbody></table></section> : null}
      {activeTab === "Equipo" ? <section className="card report-card"><h2>Actividad del equipo</h2><table><thead><tr><th>Usuario</th><th>Expedientes</th><th>Presupuestos</th><th>Aceptados</th><th>Tareas completadas</th><th>Tareas vencidas</th><th>Valor aceptado</th><th>Margen medio</th></tr></thead><tbody>{team.map((row) => <tr key={row.userId}><td>{row.userName}</td><td>{row.activeCases}</td><td>{row.budgetsCreated}</td><td>{row.budgetsAccepted}</td><td>{row.completedTasks}</td><td>{row.overdueTasks}</td><td>{money(row.acceptedValue)}</td><td>{percent(row.averageMarginPct)}</td></tr>)}</tbody></table></section> : null}
    </div>
  );
}
