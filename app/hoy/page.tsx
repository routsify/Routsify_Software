import { AppShell } from "@/components/AppShell";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationClients, listOrganizationProposals, listOrganizationPurchases } from "@/lib/organization-repositories";

type CaseRow = { id?: string; case_code?: string; title?: string; status?: string; destination?: string; next_action?: string | null; clients?: { display_name?: string | null } | null };
type ProposalRow = { id?: string; status?: string; cases?: { id?: string; case_code?: string; clients?: { display_name?: string | null } | null } | null };
type PurchaseRow = { id?: string; supplier_name?: string; service?: string; status?: string; amount?: number | string; expected_amount?: number | string; currency?: string; cases?: { case_code?: string | null } | null };

const caseLabels: Record<string, string> = {
  new_lead: "Nuevo",
  call_booked: "Llamada reservada",
  call_done: "Llamada realizada",
  budget_draft: "Presupuesto en preparación",
  proposal_sent: "Presupuesto enviado",
  proposal_accepted: "Presupuesto aceptado",
  contract_ready: "Contrato preparado",
  contract_signed: "Contrato firmado",
  payment_confirmed: "Pago confirmado",
  suppliers_pending: "Proveedores pendientes",
  ready_to_close: "Listo para cierre",
  closed: "Cerrado",
};

const purchaseLabels: Record<string, string> = {
  expected: "Pendiente",
  requested: "Solicitada",
  uploaded: "Documento recibido",
  holded_candidate: "Candidata en Holded",
  matched: "Conciliada",
  review_needed: "Revisión necesaria",
  approved: "Aprobada",
  not_required: "No necesaria",
  cancelled: "Cancelada",
};

function money(value: unknown, currency = "EUR") {
  const number = Number(value || 0);
  return Number.isFinite(number) && number !== 0 ? new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(number) : "—";
}

export default async function TodayWorkbenchPage() {
  const session = await requireAppSession();
  const [clientsResult, casesResult, proposalsResult, purchasesResult] = await Promise.all([
    listOrganizationClients(session.organizationId),
    listOrganizationCases(session.organizationId),
    listOrganizationProposals(session.organizationId),
    listOrganizationPurchases(session.organizationId),
  ]);

  const clients = clientsResult.ok ? clientsResult.data : [];
  const cases = (casesResult.ok ? casesResult.data : []) as CaseRow[];
  const proposals = (proposalsResult.ok ? proposalsResult.data : []) as ProposalRow[];
  const purchases = (purchasesResult.ok ? purchasesResult.data : []) as PurchaseRow[];
  const activeCases = cases.filter((item) => item.status !== "closed");
  const pendingPurchases = purchases.filter((item) => !["approved", "cancelled", "not_required"].includes(String(item.status || "")));
  const openBudgets = proposals.filter((item) => !["accepted", "rejected"].includes(String(item.status || "")));
  const urgentCases = activeCases.filter((item) => item.next_action).slice(0, 8);

  const kpis = [
    { label: "Clientes", value: clients.length, note: "Registrados", icon: "C", href: "/clientes" },
    { label: "Expedientes activos", value: activeCases.length, note: "En seguimiento", icon: "E", href: "/expedientes" },
    { label: "Presupuestos abiertos", value: openBudgets.length, note: "Sin decisión final", icon: "P", href: "/propuestas" },
    { label: "Compras pendientes", value: pendingPurchases.length, note: "Por resolver", icon: "€", href: "/compras" },
  ];

  return (
    <AppShell>
      <section className="home-title"><h1>Inicio</h1><p>Resumen de la operativa que requiere atención.</p></section>

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
          <div className="panel-head"><h2>Próximas acciones</h2><a className="btn secondary" href="/expedientes">Ver expedientes</a></div>
          {urgentCases.length === 0 ? <div className="empty-state"><h2>No hay acciones pendientes</h2><p>Los expedientes con próxima acción aparecerán aquí.</p></div> : (
            <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Cliente</th><th>Fase</th><th>Próxima acción</th></tr></thead><tbody>
              {urgentCases.map((item) => (
                <tr key={item.id || item.case_code}><td><a href={`/expedientes?caseId=${encodeURIComponent(String(item.id || ""))}`}><strong>{item.case_code || "Sin código"}</strong></a><br/><small>{item.title || item.destination || "Expediente"}</small></td><td>{item.clients?.display_name || "—"}</td><td><span className="status-pill status-progress">{caseLabels[String(item.status)] || String(item.status || "Pendiente")}</span></td><td>{item.next_action || "—"}</td></tr>
              ))}
            </tbody></table></div>
          )}
        </div>

        <div className="card dashboard-table-card">
          <div className="panel-head"><h2>Compras pendientes</h2><a className="btn secondary" href="/compras">Ver compras</a></div>
          {pendingPurchases.length === 0 ? <div className="empty-state"><h2>No hay compras pendientes</h2><p>Las compras abiertas aparecerán aquí.</p></div> : (
            <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Proveedor</th><th>Estado</th><th>Importe</th></tr></thead><tbody>
              {pendingPurchases.slice(0, 8).map((item) => (
                <tr key={item.id || `${item.supplier_name}-${item.service}`}><td>{item.cases?.case_code || "—"}</td><td><strong>{item.supplier_name || "Proveedor"}</strong><br/><small>{item.service || "—"}</small></td><td><span className="status-pill status-pending">{purchaseLabels[String(item.status)] || String(item.status || "Pendiente")}</span></td><td>{money(item.amount || item.expected_amount, item.currency || "EUR")}</td></tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
