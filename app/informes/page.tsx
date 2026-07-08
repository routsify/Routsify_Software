import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { formatReportMoney, formatReportPercent, funnelReport, marginReports, reportSummary, sourceReports, stageTimingReports, supplierIssues } from "@/lib/reports";

export default function ReportsPage() {
  const summary = reportSummary();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Informes"
        title="Reporting operativo mínimo"
        description="KPIs calculados desde los datos demo de solicitudes, clientes, expedientes, presupuesto, pagos, compras e integraciones."
        action={<a className="btn" href="/hoy">Abrir Hoy</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Leads + clientes</span><div className="metric">{summary.totalLeads}</div><p>Entradas y fichas con origen trazado.</p></div>
        <div className="card"><span className="badge">Aceptadas</span><div className="metric">{summary.totalAccepted}</div><p>{formatReportMoney(summary.acceptedValue)} de valor aceptado.</p></div>
        <div className="card"><span className="badge">Bloqueos</span><div className="metric">{summary.blockedCases}</div><p>{summary.openSupplierItems} incidencias de proveedor abiertas.</p></div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Embudo</div>
          <h2>Lead → pago confirmado</h2>
          <table><thead><tr><th>Fase</th><th>Volumen</th><th>Conversión</th><th>Siguiente acción</th></tr></thead><tbody>{funnelReport.map((item) => <tr key={item.stage}><td>{item.stage}</td><td>{item.count}</td><td>{formatReportPercent(item.conversion_from_previous)}</td><td>{item.next_action}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Origen</div>
          <h2>Rendimiento por canal</h2>
          <table><thead><tr><th>Origen</th><th>Leads</th><th>Llamadas</th><th>Aceptadas</th><th>Conversión</th><th>Valor</th></tr></thead><tbody>{sourceReports.map((item) => <tr key={item.source}><td>{item.source}</td><td>{item.leads}</td><td>{item.calls}</td><td>{item.proposals_accepted}</td><td>{formatReportPercent(item.conversion_rate)}</td><td>{formatReportMoney(item.accepted_value)}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Margen</div>
          <h2>Previsto frente a real</h2>
          <table><thead><tr><th>Expediente</th><th>Venta</th><th>Coste previsto</th><th>Compra esperada</th><th>Coste real</th><th>Margen previsto</th><th>Desviación</th></tr></thead><tbody>{marginReports.map((item) => <tr key={item.case_code}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a><br/><small>{item.client} · {item.destination}</small></td><td>{formatReportMoney(item.sale)}</td><td>{formatReportMoney(item.budget_cost)}</td><td>{formatReportMoney(item.expected_purchase_cost)}</td><td>{item.real_cost ? formatReportMoney(item.real_cost) : "pendiente"}</td><td>{formatReportPercent(item.margin_expected)}</td><td>{item.real_cost ? formatReportMoney(item.deviation) : "—"}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Expedientes</div>
          <h2>Tiempo y estado operativo</h2>
          <table><thead><tr><th>Expediente</th><th>Fase</th><th>Días viaje</th><th>Salud</th><th>Siguiente acción</th></tr></thead><tbody>{stageTimingReports.map((item) => <tr key={item.case_code}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a><br/><small>{item.client}</small></td><td>{item.current_stage}</td><td>{item.days_until_trip}</td><td><span className="badge">{item.health}</span></td><td>{item.next_action}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">Proveedores</div>
        <h2>Incidencias que afectan al cierre</h2>
        <table><thead><tr><th>Proveedor</th><th>Expediente</th><th>Destino</th><th>Estado</th><th>Importe</th><th>Motivo</th><th>Acción</th></tr></thead><tbody>{supplierIssues.map((item) => <tr key={`${item.case_code}-${item.supplier}`}><td>{item.supplier}</td><td><a href={`/expedientes/${item.case_code}`}>{item.case_code}</a></td><td>{item.destination}</td><td><span className="badge">{item.status}</span></td><td>{formatReportMoney(item.amount)}</td><td>{item.reason}</td><td>{item.action}</td></tr>)}</tbody></table>
      </section>
    </AppShell>
  );
}
