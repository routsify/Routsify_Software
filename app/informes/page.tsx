import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { loadBusinessIntelligence, type CurrencyFinancials, type PerformanceRow, type ReportPeriod } from "@/lib/business-intelligence-server";

function money(value: unknown, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}
function percent(value: unknown) { return `${Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`; }
function hours(value: number | null) {
  if (value === null) return "Sin datos";
  if (value < 48) return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;
  return `${(value / 24).toLocaleString("es-ES", { maximumFractionDigits: 1 })} días`;
}
function days(value: number | null) { return value === null ? "Sin datos" : `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} días`; }
function periodValue(value?: string): ReportPeriod { const parsed = Number(value); return parsed === 30 || parsed === 90 || parsed === 0 ? parsed : 365; }
function barWidth(value: number, maximum: number) { return maximum > 0 ? Math.max(2, Math.min(100, value / maximum * 100)) : 2; }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireAppPermission("reports.view");
  const { period: rawPeriod } = await searchParams;
  const report = await loadBusinessIntelligence(session.organizationId, periodValue(rawPeriod));
  const primaryFinancial = report.financials.find((item) => item.currency === "EUR") || report.financials[0] || null;
  const maxMonthly = Math.max(1, ...report.monthly.map((item) => Math.max(item.acceptedSales, item.payments)));

  return <AppShell>
    <PageHeader
      eyebrow="Informes"
      title="Dirección y optimización de la agencia"
      description="Analiza conversión, tiempos, carga de trabajo, cobros, rentabilidad, destinos, fuentes y proveedores usando los datos operativos reales."
      action={<a className="btn secondary" href={`/api/routsify/reports/export?period=${report.period}`}>Exportar CSV</a>}
    />

    <section className="card form-actions">
      <strong>Periodo:</strong>
      {([30, 90, 365, 0] as const).map((period) => <Link key={period} className={report.period === period ? "btn" : "btn secondary"} href={`/informes?period=${period}`}>{period === 30 ? "30 días" : period === 90 ? "90 días" : period === 365 ? "12 meses" : "Histórico"}</Link>)}
      <span>{report.periodLabel}</span>
    </section>

    <section className="client-kpis">
      <Kpi icon="S" label="Solicitudes" value={report.counts.leads} note={`${report.counts.callsBooked} llamadas reservadas`} />
      <Kpi icon="V" label="Conversión a venta" value={percent(report.conversion.caseToAccepted)} note={`${report.counts.acceptedCases} expedientes aceptados`} />
      <Kpi icon="€" label="Ventas aceptadas" value={primaryFinancial ? money(primaryFinancial.acceptedSales, primaryFinancial.currency) : money(0)} note={primaryFinancial ? `${money(primaryFinancial.outstanding, primaryFinancial.currency)} por cobrar` : "Sin ventas"} />
      <Kpi icon="B" label="Beneficio real" value={primaryFinancial ? money(primaryFinancial.realProfit, primaryFinancial.currency) : money(0)} note={primaryFinancial ? `${percent(primaryFinancial.realMargin)} de margen` : "Sin datos"} />
      <Kpi icon="!" label="Expedientes críticos" value={report.caseHealth.critical} note={`${report.caseHealth.attention} requieren atención`} />
      <Kpi icon="T" label="Tareas vencidas" value={report.taskHealth.overdue} note={`${percent(report.taskHealth.completionRate)} completadas`} />
    </section>

    <section className="dashboard-panels">
      <div className="card dashboard-table-card">
        <div className="panel-head"><div><h2>Embudo comercial</h2><p>Conversión entre cada paso del proceso.</p></div><Link className="btn secondary" href="/clientes">Abrir clientes</Link></div>
        <div className="grid grid-2">
          <Metric label="Lead → llamada" value={percent(report.conversion.leadToCall)} note={`${report.counts.callsBooked} de ${report.counts.leads}`} />
          <Metric label="Lead → expediente" value={percent(report.conversion.leadToCase)} note={`${report.counts.cases} expedientes`} />
          <Metric label="Expediente → venta" value={percent(report.conversion.caseToAccepted)} note={`${report.counts.acceptedCases} aceptados`} />
          <Metric label="Presupuesto → venta" value={percent(report.conversion.proposalToAccepted)} note={`${report.counts.acceptedProposals} de ${report.counts.proposals}`} />
        </div>
      </div>

      <div className="card dashboard-table-card">
        <div className="panel-head"><div><h2>Tiempo del proceso</h2><p>Localiza dónde se retrasa la gestión.</p></div><Link className="btn secondary" href="/expedientes">Abrir expedientes</Link></div>
        <div className="grid grid-2">
          <Metric label="Solicitud → expediente" value={hours(report.timing.leadToCaseHours)} note="Tiempo medio" />
          <Metric label="Expediente → presupuesto" value={hours(report.timing.caseToProposalHours)} note="Tiempo medio" />
          <Metric label="Presupuesto → aceptación" value={hours(report.timing.proposalToAcceptanceHours)} note="Tiempo medio del cliente" />
          <Metric label="Expediente → cierre" value={days(report.timing.caseToCloseDays)} note="Ciclo completo" />
        </div>
      </div>
    </section>

    <section className="card dashboard-table-card">
      <div className="panel-head"><div><h2>Salud financiera por moneda</h2><p>No se mezclan divisas en los totales.</p></div><Link className="btn secondary" href="/compras">Revisar compras</Link></div>
      {report.financials.length === 0 ? <Empty title="Todavía no hay ventas aceptadas" text="Los importes aparecerán cuando existan presupuestos aceptados." /> : <div className="table-scroll"><table><thead><tr><th>Moneda</th><th>Venta</th><th>Cobrado</th><th>Pendiente</th><th>Coste presup.</th><th>Coste real</th><th>Beneficio real</th><th>Margen</th><th>Pipeline</th></tr></thead><tbody>{report.financials.map((item) => <FinancialRow key={item.currency} item={item} />)}</tbody></table></div>}
    </section>

    <section className="dashboard-panels">
      <PerformanceTable title="Fuentes de clientes" description="Qué canales generan más solicitudes y ventas." rows={report.sources.slice(0, 10)} kind="source" empty="No hay fuentes registradas." />
      <PerformanceTable title="Destinos más rentables" description="Ventas, beneficio y margen por destino." rows={report.destinations.slice(0, 10)} kind="destination" empty="No hay destinos con actividad." />
    </section>

    <section className="card dashboard-table-card">
      <div className="panel-head"><div><h2>Rendimiento de proveedores</h2><p>Coste presupuestado, coste real, desviaciones y compras pendientes.</p></div><Link className="btn secondary" href="/proveedores">Abrir proveedores</Link></div>
      {report.suppliers.length === 0 ? <Empty title="Sin compras de proveedores" text="El rendimiento aparecerá cuando se registren compras." /> : <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Compras</th><th>Pendientes</th><th>Presupuestado</th><th>Coste real</th><th>Desviación</th></tr></thead><tbody>{report.suppliers.slice(0, 15).map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td>{item.purchases || 0}</td><td>{item.pending || 0}</td><td>{money(item.sale)}</td><td>{money(item.cost)}</td><td className={Number(item.deviation || 0) > 0 ? "text-danger" : ""}>{money(item.deviation)}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="card dashboard-table-card">
      <div className="panel-head"><div><h2>Evolución de los últimos 12 meses</h2><p>Ventas aceptadas y cobros confirmados.</p></div></div>
      <div className="monthly-bars">{report.monthly.map((item) => <div className="monthly-bar" key={item.month}><div className="monthly-bar-values"><span title={`Ventas ${money(item.acceptedSales)}`} style={{ height: `${barWidth(item.acceptedSales, maxMonthly)}%` }} /><span title={`Cobros ${money(item.payments)}`} style={{ height: `${barWidth(item.payments, maxMonthly)}%` }} /></div><strong>{item.label}</strong><small>{item.leads} leads · {item.cases} exp.</small></div>)}</div>
      <p><strong>Leyenda:</strong> primera barra = ventas aceptadas · segunda barra = cobros.</p>
    </section>

    <section className="dashboard-panels">
      <div className="card dashboard-table-card"><div className="panel-head"><h2>Carga de trabajo</h2><Link className="btn secondary" href="/hoy">Abrir Hoy</Link></div><div className="grid grid-2"><Metric label="Abiertas" value={report.taskHealth.open} note="Pendientes y en curso" /><Metric label="Vencidas" value={report.taskHealth.overdue} note="Requieren prioridad" /><Metric label="Bloqueadas" value={report.taskHealth.blocked} note="Necesitan desbloqueo" /><Metric label="Completadas" value={report.taskHealth.done} note={percent(report.taskHealth.completionRate)} /></div></div>
      <div className="card dashboard-table-card"><div className="panel-head"><h2>Riesgo de expedientes</h2><Link className="btn secondary" href="/expedientes">Ver salud</Link></div><div className="grid grid-2"><Metric label="Críticos" value={report.caseHealth.critical} note="Actuación inmediata" /><Metric label="Atención" value={report.caseHealth.attention} note="Revisar esta semana" /><Metric label="Bloqueados" value={report.caseHealth.blocked} note="Con impedimento declarado" /><Metric label="Viajes ≤ 30 días" value={report.caseHealth.upcoming30} note="Próximas salidas" /></div></div>
    </section>
  </AppShell>;
}

function Kpi({ icon, label, value, note }: { icon: string; label: string; value: string | number; note: string }) {
  return <div className="kpi-card"><span className="kpi-icon">{icon}</span><span className="kpi-copy"><strong>{label}</strong><b>{value}</b><small>{note}</small></span></div>;
}
function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty-state"><h2>{title}</h2><p>{text}</p></div>; }
function FinancialRow({ item }: { item: CurrencyFinancials }) {
  return <tr><td><strong>{item.currency}</strong></td><td>{money(item.acceptedSales, item.currency)}</td><td>{money(item.paid, item.currency)}</td><td>{money(item.outstanding, item.currency)}</td><td>{money(item.budgetCost, item.currency)}</td><td>{money(item.realCost, item.currency)}</td><td>{money(item.realProfit, item.currency)}</td><td>{percent(item.realMargin)}</td><td>{money(item.pipeline, item.currency)}</td></tr>;
}
function PerformanceTable({ title, description, rows, kind, empty }: { title: string; description: string; rows: PerformanceRow[]; kind: "source" | "destination"; empty: string }) {
  return <div className="card dashboard-table-card"><div className="panel-head"><div><h2>{title}</h2><p>{description}</p></div></div>{rows.length === 0 ? <Empty title={empty} text="Se calculará automáticamente con la actividad futura." /> : <div className="table-scroll"><table><thead><tr><th>{kind === "source" ? "Fuente" : "Destino"}</th><th>{kind === "source" ? "Leads" : "Expedientes"}</th><th>Ventas</th><th>Conversión</th><th>{kind === "source" ? "Importe" : "Beneficio"}</th></tr></thead><tbody>{rows.map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td>{kind === "source" ? item.leads || 0 : item.cases || 0}</td><td>{item.accepted || 0}</td><td>{percent(item.conversion)}</td><td>{money(kind === "source" ? item.sale : item.profit)}</td></tr>)}</tbody></table></div>}</div>;
}
