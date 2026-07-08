import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buildOperationalInbox, workbenchSummary } from "@/lib/workbench";

export default function TodayWorkbenchPage() {
  const items = buildOperationalInbox();
  const summary = workbenchSummary(items);
  const topItems = items.slice(0, 12);
  const areaRows = Object.entries(summary.byArea).sort((a, b) => b[1] - a[1]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hoy"
        title="Centro operativo diario"
        description="Una única cola priorizada que cruza expedientes, tareas, documentos, compras, pagos, comunicaciones e integraciones para ahorrar saltos entre pantallas."
        action={<a className="btn" href="/expedientes">Ver expedientes</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Acciones abiertas</span><div className="metric">{summary.total}</div><p>Todo lo que requiere seguimiento operativo.</p></div>
        <div className="card"><span className="badge">Críticas</span><div className="metric">{summary.critical}</div><p>Bloquean contrato, pago, proveedor, integración o cierre.</p></div>
        <div className="card"><span className="badge">Alta prioridad</span><div className="metric">{summary.high}</div><p>Conviene resolver antes de avanzar nuevas propuestas.</p></div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Atender primero</div>
          <h2>Cola priorizada</h2>
          <p>La prioridad combina bloqueos de expediente, tareas urgentes, documentos faltantes, compras proveedor, cobros y errores de integración.</p>
          <table>
            <thead><tr><th>Prioridad</th><th>Área</th><th>Acción</th><th>Responsable</th><th>Seguimiento</th></tr></thead>
            <tbody>{topItems.map((item) => <tr key={`${item.source}-${item.id}`}><td><span className="badge">{item.urgency}</span></td><td>{item.area}</td><td><a href={item.href}><strong>{item.title}</strong></a><br/><small>{item.case_code || "general"} · {item.reason}</small></td><td>{item.owner}</td><td>{item.due_at || "sin fecha"}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="card">
          <div className="eyebrow">Dónde está el trabajo</div>
          <h2>Distribución por área</h2>
          <table>
            <thead><tr><th>Área</th><th>Abiertas</th><th>Ir</th></tr></thead>
            <tbody>{areaRows.map(([area, count]) => <tr key={area}><td>{area}</td><td>{count}</td><td><a href={area === "Documentos" ? "/documentos" : area === "Comunicaciones" ? "/comunicaciones" : area === "Compras" ? "/compras" : area === "Pagos" ? "/facturacion" : area === "Integraciones" ? "/integraciones" : "/tareas"}>Abrir</a></td></tr>)}</tbody>
          </table>
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow">Regla de uso</div>
            <h2>Trabajar desde aquí</h2>
            <p>El equipo debería empezar el día en esta pantalla. Los módulos especializados quedan para editar datos, pero la decisión diaria sale de esta cola.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
