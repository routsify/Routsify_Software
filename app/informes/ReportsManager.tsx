"use client";

import { useState } from "react";
import { buildDestinationValue, buildFunnel, buildPainPoints, buildProfitabilityRows, buildSupplierReport, buildTeamReport, buildTimeSeries, buildTimingMetrics, formatReportMoney, formatReportPercent, reportFilterOptions, reportSummary, reportTabs, type ReportTab } from "@/lib/report-master";

function tone(severity: string) {
  if (severity === "high") return "priority-urgent";
  if (severity === "medium") return "priority-normal";
  return "priority-low";
}

export function ReportsManager() {
  const [activeTab, setActiveTab] = useState<ReportTab>("executive");
  const summary = reportSummary();
  const timeSeries = buildTimeSeries();
  const funnel = buildFunnel();
  const destinations = buildDestinationValue();
  const timing = buildTimingMetrics();
  const painPoints = buildPainPoints();
  const profitability = buildProfitabilityRows();
  const suppliers = buildSupplierReport();
  const team = buildTeamReport();

  return (
    <div className="reports-page">
      <div className="reports-toolbar">
        <div className="reports-tabs">{reportTabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} type="button" onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div>
        <button className="btn" type="button">Exportar</button>
      </div>

      <section className="report-filters card">
        <label>Fecha<input className="input" defaultValue="2026-05-01 – 2026-05-31" /></label>
        <label>Comparar con<select defaultValue="Mes anterior">{reportFilterOptions.compare.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Responsable<select>{reportFilterOptions.responsible.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Origen del lead<select>{reportFilterOptions.origin.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Destino<select>{reportFilterOptions.destination.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Estado expediente<select>{reportFilterOptions.caseStatus.map((option) => <option key={option}>{option}</option>)}</select></label>
      </section>

      <section className="client-kpis reports-kpis">
        <a className="kpi-card" href="/propuestas"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Valor aceptado</strong><b>{formatReportMoney(summary.kpis.acceptedValue)}</b><small>+{formatReportPercent(summary.comparison.acceptedValuePct)} vs mes anterior</small></span></a>
        <a className="kpi-card" href="/contratos"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Ingresos confirmados</strong><b>{formatReportMoney(summary.kpis.confirmedRevenue)}</b><small>+{formatReportPercent(summary.comparison.confirmedRevenuePct)} vs mes anterior</small></span></a>
        <a className="kpi-card" href="/informes"><span className="kpi-icon">%</span><span className="kpi-copy"><strong>Margen medio</strong><b>{formatReportPercent(summary.kpis.averageMarginPct)}</b><small>+{summary.comparison.averageMarginPp} pp vs mes anterior</small></span></a>
        <a className="kpi-card" href="/informes"><span className="kpi-icon">◎</span><span className="kpi-copy"><strong>Beneficio estimado</strong><b>{formatReportMoney(summary.kpis.estimatedProfit)}</b><small>+{formatReportPercent(summary.comparison.estimatedProfitPct)} vs mes anterior</small></span></a>
        <a className="kpi-card" href="/expedientes"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Expedientes activos</strong><b>{summary.kpis.activeCases}</b><small>+{summary.comparison.activeCasesDiff} vs mes anterior</small></span></a>
        <a className="kpi-card" href="/hoy"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Tareas pendientes</strong><b>{summary.kpis.pendingTasks}</b><small>{summary.comparison.pendingTasksDiff} vs mes anterior</small></span></a>
      </section>

      {activeTab === "executive" ? <section className="reports-grid">
        <section className="card report-card"><h2>Evolución del valor aceptado</h2><div className="line-chart-demo">{timeSeries.map((point) => <a key={point.date} href="/propuestas" style={{ height: `${Math.max(18, point.acceptedValue / 3000)}px` }}><span>{point.date}</span></a>)}</div></section>
        <section className="card report-card"><h2>Embudo de conversión</h2><table><tbody>{funnel.map((step) => <tr key={step.key}><th>{step.label}</th><td><div className="progress-track"><span style={{ width: `${step.conversionFromLeadPct}%` }} /></div></td><td>{step.count}</td><td>{formatReportPercent(step.conversionFromLeadPct)}</td></tr>)}</tbody></table></section>
        <section className="card report-card"><h2>Valor aceptado por destino</h2><div className="donut-list">{destinations.map((item) => <a key={item.destination} href="/expedientes"><strong>{item.destination}</strong><span>{formatReportMoney(item.value)} · {formatReportPercent(item.sharePct)}</span></a>)}</div></section>
        <section className="card report-card"><h2>Tiempos clave</h2><div className="mini-kpis">{timing.map((item) => <a key={item.key} className={`mini-kpi ${item.status}`} href={item.drilldownUrl}><strong>{item.averageDays} días</strong><span>{item.label}</span><small>Objetivo {item.targetDays} días</small></a>)}</div></section>
        <section className="card report-card"><h2>Top puntos de dolor</h2><table><tbody>{painPoints.map((point) => <tr key={point.key}><td><a href={point.drilldownUrl}>{point.title}</a></td><td>{point.count}</td><td>{point.economicImpact ? formatReportMoney(point.economicImpact) : "—"}</td><td><span className={`status-pill ${tone(point.severity)}`}>{point.severity}</span></td></tr>)}</tbody></table></section>
      </section> : null}

      {activeTab === "economic" ? <section className="card report-card"><h2>Ingresos vs costes vs beneficio</h2><table><thead><tr><th>Fecha</th><th>Ingresos</th><th>Beneficio</th><th>Aceptados</th></tr></thead><tbody>{timeSeries.map((point) => <tr key={point.date}><td>{point.date}</td><td>{formatReportMoney(point.confirmedRevenue)}</td><td>{formatReportMoney(point.estimatedProfit)}</td><td>{point.budgetsAccepted}</td></tr>)}</tbody></table></section> : null}
      {activeTab === "suppliers" ? <section className="card report-card"><h2>Proveedores que bloquean cierre</h2><table><tbody>{suppliers.map((row) => <tr key={row.providerName}><td><a href="/compras">{row.providerName}</a></td><td>{row.pending} pendientes</td><td>{row.incidents} incidencias</td><td>{formatReportMoney(row.pendingValue)}</td></tr>)}</tbody></table></section> : null}
      {activeTab === "profitability" ? <section className="card report-card"><h2>Rentabilidad por expediente</h2><table><tbody>{profitability.map((row) => <tr key={row.caseCode}><td><a href={`/expedientes/${row.caseCode}`}>{row.caseCode}</a></td><td>{row.clientName}</td><td>{row.destination}</td><td>{formatReportMoney(row.salePrice)}</td><td>{formatReportPercent(row.realMarginPct)}</td><td>{formatReportMoney(row.costDeviation)}</td></tr>)}</tbody></table></section> : null}
      {activeTab === "team" ? <section className="card report-card"><h2>Actividad del equipo</h2><table><tbody>{team.map((row) => <tr key={row.userId}><td>{row.userName}</td><td>{row.activeCases} expedientes</td><td>{row.budgetsAccepted} aceptados</td><td>{row.completedTasks} tareas</td><td>{formatReportMoney(row.acceptedValue)}</td></tr>)}</tbody></table></section> : null}
      {["budgets", "clients", "timing"].includes(activeTab) ? <section className="card report-card"><h2>Vista accionable</h2><p>Esta pestaña reutiliza los filtros globales y abre el detalle operativo desde cada fila para resolver bloqueos, tiempos altos o márgenes bajos.</p></section> : null}
    </div>
  );
}
