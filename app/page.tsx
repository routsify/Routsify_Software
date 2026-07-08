import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { cases, expectedPurchases } from "@/lib/mock-data";

export default function DashboardPage() {
  const blocked = cases.filter((item) => item.blocker).length;
  const pendingPurchases = expectedPurchases.filter((item) => item.status !== "approved").length;
  const pipeline = cases.reduce((sum, item) => sum + item.accepted_value, 0);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Routsify Software · MVP"
        title="Qué necesita acción hoy"
        description="Backoffice interno con datos ficticios: clientes, expedientes, propuesta visual, tipos de servicio configurables y compras esperadas. Preparado para conectar Supabase real."
        action={<a className="btn" href="/expedientes">Ver expedientes</a>}
      />
      <section className="grid grid-3">
        <div className="card"><span className="badge">Expedientes activos</span><div className="metric">{cases.length}</div><p>Operativa abierta con próxima acción.</p></div>
        <div className="card"><span className="badge">Bloqueos</span><div className="metric">{blocked}</div><p>Casos con bloqueo visible para dirección y operaciones.</p></div>
        <div className="card"><span className="badge">Compras pendientes</span><div className="metric">{pendingPurchases}</div><p>Facturas proveedor esperadas antes del cierre.</p></div>
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Pipeline aceptado</div><h2>{pipeline.toLocaleString("es-ES")} €</h2></div>
          <a className="btn secondary" href="/propuestas/demo-public-token">Abrir propuesta pública</a>
        </div>
      </section>
    </AppShell>
  );
}
