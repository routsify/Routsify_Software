import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { formatReportMoney, formatReportPercent, funnelReport, marginReports, reportSummary, sourceReports, supplierIssues } from "@/lib/reports";

export default function ReportsPage() {
  const summary = reportSummary();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Informes"
        title="Reporting operativo mínimo"
        description="KPIs demo de origen, conversión, pipeline, margen previsto/real y proveedores con incidencias."
        action={<a className="btn" href="/">Volver al dashboard</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Leads</span><div className="metric">{summary.totalLeads}</div><p>Entradas demo recibidas por origen.</p></div>
        <div className="card"><span className="badge">Aceptadas</span><div className="metric">{summary.totalAccepted}</div><p>{formatReportMoney(summary.acceptedValue)} de valor aceptado.</p></div>
        <div className="card"><span className="badge">Proveedor</span><div className="metric">{summary.openSupplierItems}</div><p>Incidencias abiertas que pueden bloquear cierre.</p></div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Embudo</div>
          <h2>Lead → pago confirmado</h2>
          <table><thead><tr><th>Fase</th><th>Volumen</th><th>Conversión</th></tr></thead><tbody>{funnelReport.map((item) => <tr key={item.stage}><td>{item.stage}</td><td>{item.count}</td><td>{formatReportPercent(item.conversion_from_previous)}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Origen</div>
          <h2>Rendimiento por canal</h2>
          <table><thead><tr><th>Origen</th><th>Leads</th><th>Llamadas</th><th>Aceptadas</th><th>Valor</th></tr></thead><tbody>{sourceReports.map((item) => <tr key={item.source}><td>{item.source}</td><td>{item.leads}</td><td>{item.calls}</td><td>{item.proposals_accepted}</td><td>{formatReportMoney(item.accepted_value)}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Margen</div>
          <h2>Previsto frente a real</h2>
          <table><thead><tr><th>Expediente</th><th>Venta</th><th>Coste previsto</th><th>Coste real</th><th>Desviación</th></tr></thead><tbody>{marginReports.map((item) => <tr key={item.case_code}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a><br/><small>{item.client} · {item.destination}</small></td><td>{formatReportMoney(item.sale)}</td><td>{formatReportMoney(item.budget_cost)}</td><td>{item.real_cost ? formatReportMoney(item.real_cost) : "pendiente"}</td><td>{item.real_cost ? formatReportMoney(item.real_profit - item.budget_profit) : "—"}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Proveedores</div>
          <h2>Incidencias operativas</h2>
          <table><thead><tr><th>Proveedor</th><th>Destino</th><th>Abiertas</th><th>Retraso medio</th><th>Motivo</th></tr></thead><tbody>{supplierIssues.map((item) => <tr key={item.supplier}><td>{item.supplier}</td><td>{item.destination}</td><td>{item.open_items}</td><td>{item.average_delay_days} días</td><td>{item.reason}</td></tr>)}</tbody></table>
        </div>
      </section>
    </AppShell>
  );
}
