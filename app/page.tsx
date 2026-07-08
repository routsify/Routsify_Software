import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { cases, expectedPurchases } from "@/lib/mock-data";
import { appModules, moduleSummary } from "@/lib/navigation";

export default function DashboardPage() {
  const blocked = cases.filter((item) => item.blocker).length;
  const pendingPurchases = expectedPurchases.filter((item) => item.status !== "approved").length;
  const pipeline = cases.reduce((sum, item) => sum + item.accepted_value, 0);
  const modules = moduleSummary(appModules);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Routsify Software · MVP"
        title="Mapa funcional del sistema"
        description="El dashboard explica el flujo completo. Para trabajar cada día, entra en Hoy: una única cola priorizada con bloqueos y acciones de todos los módulos."
        action={<a className="btn" href="/hoy">Abrir Hoy</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Expedientes activos</span><div className="metric">{cases.length}</div><p>Operativa abierta con próxima acción.</p></div>
        <div className="card"><span className="badge">Bloqueos</span><div className="metric">{blocked}</div><p>Casos con bloqueo visible para dirección y operaciones.</p></div>
        <div className="card"><span className="badge">Compras pendientes</span><div className="metric">{pendingPurchases}</div><p>Facturas proveedor esperadas antes del cierre.</p></div>
      </section>

      <section className="grid grid-3" style={{ marginTop: 18 }}>
        <div className="card"><span className="badge">Pipeline aceptado</span><div className="metric">{pipeline.toLocaleString("es-ES")} €</div><p>Valor ficticio aceptado en expedientes demo.</p></div>
        <div className="card"><span className="badge">Módulos demo</span><div className="metric">{modules.demoReady}/{modules.total}</div><p>{modules.prepared} módulos preparados para conexión real.</p></div>
        <div className="card"><span className="badge">Modo actual</span><div className="metric">Demo</div><p>No activar Supabase real hasta cerrar el esqueleto funcional.</p></div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Mapa funcional</div>
            <h2>Flujo completo del MVP</h2>
            <p>Orden lógico de trabajo y responsabilidad por módulo. Hoy es la capa de decisión diaria; el resto son pantallas especializadas.</p>
          </div>
          <a className="btn secondary" href="/hoy">Trabajar acciones abiertas</a>
        </div>
        <table>
          <thead><tr><th>Fase</th><th>Módulo</th><th>Responsable</th><th>Estado</th><th>Función</th></tr></thead>
          <tbody>
            {appModules.map((module) => (
              <tr key={module.href}>
                <td>{module.stage}</td>
                <td><a href={module.href}><strong>{module.label}</strong></a></td>
                <td>{module.owner}</td>
                <td><span className="badge">{module.status}</span></td>
                <td>{module.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
