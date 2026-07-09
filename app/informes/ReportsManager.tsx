"use client";

import { useMemo, useState } from "react";
import { budgetRows, clientRows, destinations, filters, funnelSteps, money, painPoints, percent, profitabilityRows, reportTabs, supplierRows, summaryMetrics, teamRows, timeSeries, timingMetrics, type ReportTabLabel } from "@/lib/report-decision";
import { DestinationDonut, FinanceLines, FunnelVisual, MiniTimingCards, ReportCard, TeamBars, TimingBars, ValueLineChart } from "./ReportCharts";

function severityClass(severity: string) {
  if (severity === "high") return "priority-urgent";
  if (severity === "medium") return "priority-normal";
  return "priority-low";
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
  const keyTiming = timing.filter((item) => ["call_to_budget", "budget_to_sent", "sent_to_accepted", "cycle_total"].includes(item.key));
  const shareUrl = `/informes?from=${from}&to=${to}&responsible=${responsible}&origin=${origin}&destination=${destination}&caseStatus=${caseStatus}&provider=${provider}&issues=${onlyIssues}`;

  return (
    <div className="reports-page" style={{ display: "grid", gap: 18 }}>
      <div className="reports-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div className="reports-tabs" style={{ display: "flex", gap: 8, overflowX: "auto" }}>{reportTabs.map((tab) => <button key={tab} className={activeTab === tab ? "btn" : "btn secondary"} type="button" onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
        <div className="reports-actions" style={{ display: "flex", gap: 10 }}><a className="btn secondary" href={shareUrl}>Compartir filtros</a><button className="btn" type="button">Exportar</button></div>
      </div>

      <section className="report-filters card" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 12 }}>
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

      <section className="client-kpis reports-kpis" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        <a className="kpi-card" href="/propuestas?status=accepted"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Valor aceptado</strong><b>{money(summary.acceptedValue)}</b><small>+18,6% vs {compare.toLowerCase()}</small></span></a>
        <a className="kpi-card" href="/contratos?payment=confirmed"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Ingresos confirmados</strong><b>{money(summary.confirmedRevenue)}</b><small>+12,2% vs periodo</small></span></a>
        <a className="kpi-card" href="/informes"><span className="kpi-icon">%</span><span className="kpi-copy"><strong>Margen medio</strong><b>{percent(summary.averageMarginPct)}</b><small>Real {percent(summary.realMarginPct)}</small></span></a>
        <a className="kpi-card" href="/informes"><span className="kpi-icon">◎</span><span className="kpi-copy"><strong>Beneficio estimado</strong><b>{money(summary.estimatedProfit)}</b><small>Real {money(summary.realProfit)}</small></span></a>
        <a className="kpi-card" href="/expedientes"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Expedientes activos</strong><b>{summary.activeCases}</b><small>+12 vs mes anterior</small></span></a>
        <a className="kpi-card" href="/hoy"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Tareas pendientes</strong><b>{summary.pendingTasks}</b><small>-6 vs mes anterior</small></span></a>
      </section>

      {activeTab === "Resumen ejecutivo" ? <section className="reports-grid" style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr .95fr", gap: 18 }}>
        <ReportCard title="Evolución del valor aceptado" action={<select><option>Diario</option><option>Semanal</option><option>Mensual</option></select>}><ValueLineChart data={series} /></ReportCard>
        <ReportCard title="Embudo de conversión"><FunnelVisual data={funnel} /><p><strong>Ratio final Leads → Pagos:</strong> {percent(funnel[funnel.length - 1]?.conversionFromLeadPct || 0)}</p></ReportCard>
        <ReportCard title="Valor aceptado por destino"><DestinationDonut data={destinationRows} /></ReportCard>
        <ReportCard title="Tiempo medio por etapa"><TimingBars data={timing.slice(0, 5)} /></ReportCard>
        <ReportCard title="Tiempos clave"><MiniTimingCards data={keyTiming} /></ReportCard>
        <ReportCard title="Top puntos de dolor"><table><tbody>{pains.map((point) => <tr key={point.key}><td><a href={point.url}>{point.title}</a></td><td>{point.count}</td><td>{point.economicImpact ? money(point.economicImpact) : "—"}</td><td><span className={`status-pill ${severityClass(point.severity)}`}>{point.severity}</span></td><td><a href={point.url}>{point.actionLabel}</a></td></tr>)}</tbody></table></ReportCard>
      </section> : null}

      {activeTab === "Económicos" ? <section className="reports-grid" style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}><ReportCard title="KPIs económicos"><table><tbody><tr><th>Valor presupuestado</th><td>{money(summary.acceptedValue + 80000)}</td></tr><tr><th>Valor aceptado</th><td>{money(summary.acceptedValue)}</td></tr><tr><th>Ingresos confirmados</th><td>{money(summary.confirmedRevenue)}</td></tr><tr><th>Pendiente de cobro</th><td>{money(summary.pendingCollection)}</td></tr><tr><th>Coste presupuestado</th><td>{money(summary.budgetedCost)}</td></tr><tr><th>Coste real aprobado</th><td>{money(summary.realCost)}</td></tr><tr><th>Desviación coste</th><td>{money(summary.costDeviation)}</td></tr></tbody></table></ReportCard><ReportCard title="Ingresos vs costes vs beneficio"><FinanceLines data={series} /><p><span className="status-pill status-progress">Ingresos</span> <span className="status-pill priority-normal">Beneficio previsto</span> <span className="status-pill status-pending">Beneficio real</span></p></ReportCard></section> : null}
      {activeTab === "Presupuestos" ? <ReportCard title="Eficiencia de presupuestos"><table><thead><tr><th>Presupuesto</th><th>Cliente</th><th>Estado</th><th>Responsable</th><th>Venta</th><th>Margen</th><th>T. crear</th><th>Acción</th></tr></thead><tbody>{budgets.map((row) => <tr key={row.code}><td><a href="/propuestas">{row.code}</a></td><td>{row.clientName}</td><td>{row.status}</td><td>{row.responsibleName}</td><td>{money(row.totalSalePrice)}</td><td>{percent(row.marginPct)}</td><td>{row.createdDays} días</td><td><a href="/propuestas">Abrir</a></td></tr>)}</tbody></table></ReportCard> : null}
      {activeTab === "Clientes" ? <ReportCard title="Clientes únicos y conversión"><table><thead><tr><th>Cliente</th><th>Origen</th><th>Expedientes</th><th>Valor aceptado</th><th>Ticket medio</th><th>Fiscalidad</th><th>Duplicado</th></tr></thead><tbody>{clients.map((row) => <tr key={row.clientId}><td><a href="/clientes">{row.clientName}</a></td><td>{row.origin}</td><td>{row.activeCases}</td><td>{money(row.acceptedValue)}</td><td>{money(row.ticketAvg)}</td><td>{row.fiscalValidated ? "Completa" : "Pendiente"}</td><td>{row.duplicateStatus}</td></tr>)}</tbody></table></ReportCard> : null}
      {activeTab === "Tiempos y productividad" ? <section className="reports-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}><ReportCard title="Métricas de tiempo"><TimingBars data={timing} /></ReportCard><ReportCard title="Equipo y cuellos de botella"><table><tbody>{team.map((row) => <tr key={row.userId}><td>{row.userName}</td><td>{row.activeCases} expedientes</td><td>{row.overdueTasks} vencidas</td><td>{row.blockers} bloqueos</td><td>{row.averageBudgetCreationDays} días crear presupuesto</td></tr>)}</tbody></table></ReportCard></section> : null}
      {activeTab === "Proveedores" ? <ReportCard title="Proveedores que bloquean cierre"><table><thead><tr><th>Proveedor</th><th>Esperadas</th><th>Recibidas</th><th>Pendientes</th><th>Incidencias</th><th>Valor pendiente</th><th>Desviación</th><th>Bloqueos</th></tr></thead><tbody>{suppliers.map((row) => <tr key={row.providerName}><td><a href={`/compras?provider=${row.providerName}`}>{row.providerName}</a></td><td>{row.expected}</td><td>{row.received}</td><td>{row.pending}</td><td>{row.incidents}</td><td>{money(row.pendingValue)}</td><td>{money(row.costDeviation)}</td><td>{row.blockedCases}</td></tr>)}</tbody></table></ReportCard> : null}
      {activeTab === "Rentabilidad" ? <ReportCard title="Rentabilidad por expediente"><table><thead><tr><th>Expediente</th><th>Cliente</th><th>Destino</th><th>Venta</th><th>Coste previsto</th><th>Coste real</th><th>Margen real</th><th>Desviación</th><th>Estado</th></tr></thead><tbody>{profit.map((row) => <tr key={row.caseCode}><td><a href={`/expedientes/${row.caseCode}`}>{row.caseCode}</a></td><td>{row.clientName}</td><td>{row.destination}</td><td>{money(row.salePrice)}</td><td>{money(row.budgetedCost)}</td><td>{money(row.realCost)}</td><td>{percent(row.realMarginPct)}</td><td>{money(row.costDeviation)}</td><td>{row.status}</td></tr>)}</tbody></table></ReportCard> : null}
      {activeTab === "Equipo" ? <section className="reports-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}><ReportCard title="Valor aceptado por usuario"><TeamBars data={team} /></ReportCard><ReportCard title="Actividad del equipo"><table><thead><tr><th>Usuario</th><th>Expedientes</th><th>Presupuestos</th><th>Aceptados</th><th>Tareas completadas</th><th>Tareas vencidas</th><th>Margen medio</th></tr></thead><tbody>{team.map((row) => <tr key={row.userId}><td>{row.userName}</td><td>{row.activeCases}</td><td>{row.budgetsCreated}</td><td>{row.budgetsAccepted}</td><td>{row.completedTasks}</td><td>{row.overdueTasks}</td><td>{percent(row.averageMarginPct)}</td></tr>)}</tbody></table></ReportCard></section> : null}
    </div>
  );
}
