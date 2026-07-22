import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { loadBusinessIntelligence, type CurrencyFinancials, type PerformanceRow, type ReportRangePreset } from "@/lib/business-intelligence-server";
import "./reports.css";

type ReportModule = "clientes" | "presupuestos" | "expedientes" | "compras" | "operativa";
const modules: Array<{ id: ReportModule; label: string }> = [{ id: "clientes", label: "Clientes" }, { id: "presupuestos", label: "Presupuestos" }, { id: "expedientes", label: "Expedientes" }, { id: "compras", label: "Compras y proveedores" }, { id: "operativa", label: "Operativa y cobros" }];
const presets: Array<{ id: ReportRangePreset; label: string }> = [{ id: "previous_month", label: "Mes anterior" }, { id: "15", label: "15 días" }, { id: "30", label: "30 días" }, { id: "90", label: "90 días" }, { id: "365", label: "Año" }];

function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
function percent(value: unknown) { return `${Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`; }
function hours(value: number | null) { return value === null ? "Sin datos" : value < 48 ? `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h` : `${(value / 24).toLocaleString("es-ES", { maximumFractionDigits: 1 })} días`; }
function days(value: number | null) { return value === null ? "Sin datos" : `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} días`; }
function validModule(value?: string): ReportModule { return modules.some((item) => item.id === value) ? value as ReportModule : "clientes"; }
function query(module: ReportModule, range: ReportRangePreset, from?: string, to?: string) { const params = new URLSearchParams({ module, range }); if (range === "custom" && from && to) { params.set("from", from); params.set("to", to); } return `/informes?${params}`; }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ module?: string; range?: string; from?: string; to?: string }> }) {
  const session = await requireAppPermission("reports.view");
  const params = await searchParams;
  const activeModule = validModule(params.module);
  const requestedRange = ["15", "30", "90", "365", "previous_month", "custom"].includes(String(params.range)) ? String(params.range) : "30";
  const report = await loadBusinessIntelligence(session.organizationId, { preset: requestedRange, from: params.from, to: params.to });
  const primary = report.financials.find((item) => item.currency === "EUR") || report.financials[0] || null;
  const exportParams = new URLSearchParams({ range: report.rangePreset, module: activeModule, from: report.startDate, to: report.endDate });

  return <AppShell>
    <PageHeader eyebrow="Informes" title="Decisiones por módulo" description="Cada área muestra únicamente los indicadores que ayudan a decidir, con un mismo periodo comparable." action={<a className="btn secondary" href={`/api/routsify/reports/export?${exportParams}`}>Exportar CSV</a>} />

    <section className="card report-controls">
      <div className="report-quick-ranges"><strong>Periodo</strong>{presets.map((item) => <Link key={item.id} className={report.rangePreset === item.id ? "btn" : "btn secondary"} href={query(activeModule, item.id)}>{item.label}</Link>)}</div>
      <form className="report-date-form" action="/informes" method="get"><input type="hidden" name="module" value={activeModule} /><input type="hidden" name="range" value="custom" /><label>Desde<input className="input" type="date" name="from" required defaultValue={report.startDate} /></label><label>Hasta<input className="input" type="date" name="to" required defaultValue={report.endDate} /></label><button className="btn secondary" type="submit">Aplicar fechas</button></form>
      <span className="report-period-label">Mostrando: <strong>{report.periodLabel}</strong></span>
    </section>

    <nav className="report-module-tabs" aria-label="Módulos del informe">{modules.map((item) => <Link key={item.id} className={item.id === activeModule ? "active" : ""} href={query(item.id, report.rangePreset, report.startDate, report.endDate)}>{item.label}</Link>)}</nav>

    {activeModule === "clientes" ? <>
      <section className="client-kpis"><Kpi icon="C" label="Clientes nuevos" value={report.counts.clients} note={report.periodLabel} /><Kpi icon="S" label="Solicitudes" value={report.counts.leads} note={`${report.counts.callsBooked} llamadas reservadas`} /><Kpi icon="L" label="Lead → llamada" value={percent(report.conversion.leadToCall)} note="Conversión inicial" /><Kpi icon="E" label="Lead → expediente" value={percent(report.conversion.leadToCase)} note={`${report.counts.cases} expedientes`} /></section>
      <section className="dashboard-panels"><MetricPanel title="Velocidad comercial" href="/clientes"><Metric label="Solicitud → expediente" value={hours(report.timing.leadToCaseHours)} note="Tiempo medio" /><Metric label="Solicitudes con llamada" value={report.counts.callsBooked} note={`de ${report.counts.leads}`} /></MetricPanel><PerformanceTable title="Fuentes que convierten" rows={report.sources} kind="source" /></section>
    </> : null}

    {activeModule === "presupuestos" ? <>
      <section className="client-kpis"><Kpi icon="P" label="Presupuestos" value={report.counts.proposals} note={`${report.counts.acceptedProposals} aceptados`} /><Kpi icon="%" label="Conversión" value={percent(report.conversion.proposalToAccepted)} note="Presupuesto → venta" /><Kpi icon="⏱" label="Tiempo de decisión" value={hours(report.timing.proposalToAcceptanceHours)} note="Media hasta aceptación" /><Kpi icon="€" label="Pipeline abierto" value={primary ? money(primary.pipeline, primary.currency) : money(0)} note="Solo oportunidades no aceptadas" /></section>
      <FinancialTable rows={report.financials} showPipeline />
      <PerformanceTable title="Destinos que más convierten" rows={report.destinations} kind="destination" />
    </> : null}

    {activeModule === "expedientes" ? <>
      <section className="client-kpis"><Kpi icon="E" label="Expedientes nuevos" value={report.counts.cases} note={report.periodLabel} /><Kpi icon="A" label="Activos" value={report.counts.activeCases} note={`${report.counts.closedCases} cerrados`} /><Kpi icon="!" label="Críticos" value={report.caseHealth.critical} note={`${report.caseHealth.attention} requieren atención`} /><Kpi icon="30" label="Viajes próximos" value={report.caseHealth.upcoming30} note="Salidas en 30 días" /></section>
      <section className="dashboard-panels"><MetricPanel title="Conversión y ciclo" href="/expedientes"><Metric label="Expediente → venta" value={percent(report.conversion.caseToAccepted)} note={`${report.counts.acceptedCases} aceptados`} /><Metric label="Expediente → cierre" value={days(report.timing.caseToCloseDays)} note="Ciclo completo" /><Metric label="Expediente → presupuesto" value={hours(report.timing.caseToProposalHours)} note="Tiempo medio" /><Metric label="Bloqueados" value={report.caseHealth.blocked} note="Con impedimento" /></MetricPanel><PerformanceTable title="Rentabilidad por destino" rows={report.destinations} kind="destination" /></section>
    </> : null}

    {activeModule === "compras" ? <>
      <section className="client-kpis"><Kpi icon="P" label="Proveedores activos" value={report.counts.suppliers} note="Directorio disponible" /><Kpi icon="!" label="Compras pendientes" value={report.suppliers.reduce((sum, item) => sum + Number(item.pending || 0), 0)} note="Por cerrar o revisar" /><Kpi icon="€" label="Coste real" value={money(report.suppliers.reduce((sum, item) => sum + Number(item.cost || 0), 0))} note="Compras del periodo" /><Kpi icon="Δ" label="Desviación" value={money(report.suppliers.reduce((sum, item) => sum + Number(item.deviation || 0), 0))} note="Real frente a previsto" /></section>
      <SupplierTable rows={report.suppliers} />
    </> : null}

    {activeModule === "operativa" ? <>
      <section className="client-kpis"><Kpi icon="T" label="Tareas abiertas" value={report.taskHealth.open} note={`${report.taskHealth.overdue} vencidas`} /><Kpi icon="B" label="Bloqueadas" value={report.taskHealth.blocked} note="Necesitan intervención" /><Kpi icon="✓" label="Completadas" value={percent(report.taskHealth.completionRate)} note={`${report.taskHealth.done} tareas`} /><Kpi icon="€" label="Pendiente de cobro" value={primary ? money(primary.outstanding, primary.currency) : money(0)} note="Ventas aceptadas menos cobros" /></section>
      <FinancialTable rows={report.financials} />
      <section className="dashboard-panels"><MetricPanel title="Carga de trabajo" href="/hoy"><Metric label="Abiertas" value={report.taskHealth.open} note="Pendientes y en curso" /><Metric label="Vencidas" value={report.taskHealth.overdue} note="Prioridad inmediata" /><Metric label="Bloqueadas" value={report.taskHealth.blocked} note="Requieren desbloqueo" /><Metric label="Completadas" value={report.taskHealth.done} note={percent(report.taskHealth.completionRate)} /></MetricPanel><MetricPanel title="Riesgo operativo" href="/expedientes"><Metric label="Críticos" value={report.caseHealth.critical} note="Actuación inmediata" /><Metric label="Atención" value={report.caseHealth.attention} note="Revisar esta semana" /></MetricPanel></section>
    </> : null}
  </AppShell>;
}

function Kpi({ icon, label, value, note }: { icon: string; label: string; value: string | number; note: string }) { return <div className="kpi-card"><span className="kpi-icon">{icon}</span><span className="kpi-copy"><strong>{label}</strong><b>{value}</b><small>{note}</small></span></div>; }
function Metric({ label, value, note }: { label: string; value: string | number; note: string }) { return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function MetricPanel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) { return <section className="card dashboard-table-card"><div className="panel-head"><h2>{title}</h2><Link className="btn secondary" href={href}>Abrir módulo</Link></div><div className="grid grid-2">{children}</div></section>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><h2>Sin datos en este periodo</h2><p>{text}</p></div>; }
function FinancialTable({ rows, showPipeline = false }: { rows: CurrencyFinancials[]; showPipeline?: boolean }) { return <section className="card dashboard-table-card"><div className="panel-head"><div><h2>{showPipeline ? "Ventas y pipeline por moneda" : "Cobros y rentabilidad por moneda"}</h2><p>Las divisas nunca se mezclan.</p></div></div>{rows.length ? <div className="table-scroll"><table><thead><tr><th>Moneda</th>{showPipeline ? <th>Pipeline</th> : null}<th>Venta aceptada</th><th>Cobrado</th><th>Pendiente</th><th>Coste real</th><th>Beneficio</th><th>Margen</th></tr></thead><tbody>{rows.map((item) => <tr key={item.currency}><td><strong>{item.currency}</strong></td>{showPipeline ? <td>{money(item.pipeline, item.currency)}</td> : null}<td>{money(item.acceptedSales, item.currency)}</td><td>{money(item.paid, item.currency)}</td><td>{money(item.outstanding, item.currency)}</td><td>{money(item.realCost, item.currency)}</td><td>{money(item.realProfit, item.currency)}</td><td>{percent(item.realMargin)}</td></tr>)}</tbody></table></div> : <Empty text="Los importes aparecerán cuando haya actividad económica." />}</section>; }
function PerformanceTable({ title, rows, kind }: { title: string; rows: PerformanceRow[]; kind: "source" | "destination" }) { return <section className="card dashboard-table-card"><div className="panel-head"><h2>{title}</h2></div>{rows.length ? <div className="table-scroll"><table><thead><tr><th>{kind === "source" ? "Fuente" : "Destino"}</th><th>{kind === "source" ? "Leads" : "Expedientes"}</th><th>Ventas</th><th>Conversión</th><th>{kind === "source" ? "Importe" : "Beneficio"}</th></tr></thead><tbody>{rows.slice(0, 15).map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td>{kind === "source" ? item.leads || 0 : item.cases || 0}</td><td>{item.accepted || 0}</td><td>{percent(item.conversion)}</td><td>{money(kind === "source" ? item.sale : item.profit)}</td></tr>)}</tbody></table></div> : <Empty text="Se calculará automáticamente con la actividad futura." />}</section>; }
function SupplierTable({ rows }: { rows: PerformanceRow[] }) { return <section className="card dashboard-table-card"><div className="panel-head"><div><h2>Rendimiento de proveedores</h2><p>Compara volumen, pendientes y desviación de coste.</p></div><Link className="btn secondary" href="/proveedores">Abrir proveedores</Link></div>{rows.length ? <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Compras</th><th>Pendientes</th><th>Previsto</th><th>Real</th><th>Desviación</th></tr></thead><tbody>{rows.slice(0, 25).map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td>{item.purchases || 0}</td><td>{item.pending || 0}</td><td>{money(item.sale)}</td><td>{money(item.cost)}</td><td className={Number(item.deviation || 0) > 0 ? "text-danger" : ""}>{money(item.deviation)}</td></tr>)}</tbody></table></div> : <Empty text="El rendimiento aparecerá al registrar compras." />}</section>; }
