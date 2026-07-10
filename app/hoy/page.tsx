import { AppShell } from "@/components/AppShell";
import { listCasesRepository, listClientsRepository, listPurchasesRepository } from "@/lib/server-repositories";

type CaseRow = { case_code?: string; title?: string; status?: string; destination?: string; next_action?: string | null; clients?: { display_name?: string | null } | null };
type PurchaseRow = { supplier_name?: string; service?: string; status?: string; amount?: number | string };

function statusLabel(status?: string) {
  if (!status) return "Pendiente";
  if (status === "closed") return "Cerrado";
  if (status === "proposal_sent") return "Presupuesto enviado";
  if (status === "budget_draft") return "Presupuesto en borrador";
  if (status === "new_lead") return "Nuevo";
  return status.replaceAll("_", " ");
}

export default async function TodayWorkbenchPage() {
  const [clientsResult, casesResult, purchasesResult] = await Promise.all([
    listClientsRepository(),
    listCasesRepository(),
    listPurchasesRepository(),
  ]);

  const clients = clientsResult.ok ? clientsResult.data : [];
  const cases = (casesResult.ok ? casesResult.data : []) as CaseRow[];
  const purchases = (purchasesResult.ok ? purchasesResult.data : []) as PurchaseRow[];
  const activeCases = cases.filter((item) => item.status !== "closed");
  const pendingPurchases = purchases.filter((item) => !["received", "cancelled", "not_required"].includes(String(item.status || "")));
  const pendingBudgets = cases.filter((item) => item.status === "budget_draft" || item.status === "proposal_sent");

  const kpis = [
    { label: "Clientes", value: clients.length, note: "Registrados", icon: "C", href: "/clientes" },
    { label: "Expedientes activos", value: activeCases.length, note: "En seguimiento", icon: "E", href: "/expedientes" },
    { label: "Presupuestos", value: pendingBudgets.length, note: "Borradores o enviados", icon: "P", href: "/propuestas" },
    { label: "Compras pendientes", value: pendingPurchases.length, note: "Por revisar", icon: "€", href: "/compras" },
  ];

  return (
    <AppShell>
      <section className="home-title"><h1>Inicio</h1></section>

      <section className="home-kpis">
        {kpis.map((item) => (
          <a className="kpi-card" href={item.href} key={item.label}>
            <span className="kpi-icon">{item.icon}</span>
            <span className="kpi-copy"><strong>{item.label}</strong><b>{item.value}</b><small>{item.note}</small></span>
          </a>
        ))}
      </section>

      <section className="dashboard-panels">
        <div className="card dashboard-table-card">
          <div className="panel-head"><h2>Expedientes activos</h2><a className="btn secondary" href="/expedientes">Ver expedientes</a></div>
          {activeCases.length === 0 ? <div className="empty-state"><h2>No hay expedientes activos</h2><p>Cuando crees expedientes aparecerán aquí.</p></div> : (
            <table><thead><tr><th>Expediente</th><th>Cliente</th><th>Estado</th><th>Próxima acción</th></tr></thead><tbody>
              {activeCases.slice(0, 8).map((item) => (
                <tr key={item.case_code || item.title}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code || "Sin código"}</strong></a><br/><small>{item.title || item.destination || "Expediente"}</small></td><td>{item.clients?.display_name || "—"}</td><td><span className="status-pill status-progress">{statusLabel(item.status)}</span></td><td>{item.next_action || "—"}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>

        <div className="card dashboard-table-card">
          <div className="panel-head"><h2>Compras pendientes</h2><a className="btn secondary" href="/compras">Ver compras</a></div>
          {pendingPurchases.length === 0 ? <div className="empty-state"><h2>No hay compras pendientes</h2><p>Las compras esperadas aparecerán cuando existan presupuestos aceptados o compras manuales.</p></div> : (
            <table><thead><tr><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Importe</th></tr></thead><tbody>
              {pendingPurchases.slice(0, 8).map((item, index) => (
                <tr key={`${item.supplier_name}-${index}`}><td><strong>{item.supplier_name || "Proveedor"}</strong></td><td>{item.service || "—"}</td><td><span className="status-pill status-pending">{statusLabel(item.status)}</span></td><td>{item.amount ? `${item.amount} €` : "—"}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
