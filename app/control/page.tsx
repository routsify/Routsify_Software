import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { loadOperationalHealth } from "@/lib/operational-health-server";

function severityLabel(value: string) {
  if (value === "critical") return "Crítica";
  if (value === "high") return "Alta";
  return "Media";
}

export default async function ControlPage() {
  const session = await requireAppSession();
  const data = await loadOperationalHealth(session.organizationId);

  return <AppShell>
    <PageHeader eyebrow="Supervisión" title="Control operativo" description="Salud de expedientes, alertas, tareas vencidas, integraciones y últimas automatizaciones." />

    <section className="control-kpis">
      <article className="kpi-card"><span className="kpi-copy"><strong>Salud media</strong><b>{data.summary.averageHealth}%</b><small>{data.summary.healthyCases} de {data.summary.activeCases} expedientes completos</small></span></article>
      <article className="kpi-card"><span className="kpi-copy"><strong>Alertas</strong><b>{data.summary.alerts}</b><small>{data.summary.criticalAlerts} críticas</small></span></article>
      <article className="kpi-card"><span className="kpi-copy"><strong>Tareas abiertas</strong><b>{data.summary.openTasks}</b><small>Incluye tareas vencidas y bloqueos</small></span></article>
      <article className="kpi-card"><span className="kpi-copy"><strong>Cola de integraciones</strong><b>{data.summary.pendingOutbox}</b><small>{data.summary.failedOutbox} requieren revisión</small></span></article>
    </section>

    <section className="card">
      <div className="panel-head"><div><h2>Alertas que requieren atención</h2><p>Ordenadas por impacto operativo.</p></div><span className="badge">Actualizado {new Date(data.generatedAt).toLocaleString("es-ES")}</span></div>
      {data.alerts.length ? <div className="control-alerts">{data.alerts.map((alert) => <Link className={`control-alert control-alert-${alert.severity}`} href={alert.href} key={alert.id}><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><span>{severityLabel(alert.severity)}</span></Link>)}</div> : <div className="empty-state"><h3>No hay alertas operativas</h3><p>Los expedientes, tareas y colas revisadas no presentan incidencias.</p></div>}
    </section>

    <section className="card">
      <div className="panel-head"><div><h2>Salud de expedientes activos</h2><p>Comprueba próxima acción, presupuesto, viajeros, documentación, contrato, pago, compras y bloqueos.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Estado</th><th>Viaje</th><th>Salud</th><th>Pendiente</th></tr></thead><tbody>
        {data.caseHealth.map((item) => <tr key={item.id}><td><Link href={`/expedientes/${item.id}`}><strong>{item.caseCode}</strong></Link><br/><small>{item.title}</small></td><td>{item.status}</td><td>{item.destination || "—"}<br/><small>{item.tripStart ? new Date(`${item.tripStart}T12:00:00`).toLocaleDateString("es-ES") : "Sin fecha"}</small></td><td><div className="health-meter"><span style={{ width: `${item.score}%` }} /></div><strong>{item.score}%</strong></td><td>{item.missing.length ? item.missing.join(", ") : "Completo"}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="card">
      <div className="panel-head"><div><h2>Últimas automatizaciones</h2><p>Ejecuciones registradas del outbox y los procesos internos.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Proceso</th><th>Estado</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>
        {data.latestRuns.map((run) => <tr key={run.id}><td>{run.integration}</td><td><span className={`status-pill ${run.status === "done" ? "status-success" : run.status === "processing" ? "status-warning" : "status-danger"}`}>{run.status}</span></td><td>{new Date(run.started_at).toLocaleString("es-ES")}</td><td>{run.finished_at ? new Date(run.finished_at).toLocaleString("es-ES") : "En curso"}</td></tr>)}
      </tbody></table></div>
    </section>
  </AppShell>;
}
