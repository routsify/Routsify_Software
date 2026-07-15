import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationClients, listOrganizationProposals, listOrganizationPurchases } from "@/lib/organization-repositories";

function asRows(result: { ok: boolean; data?: unknown[] }) {
  return result.ok && Array.isArray(result.data) ? result.data as Record<string, unknown>[] : [];
}

function numeric(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function relation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function addAmount(target: Map<string, number>, currency: string, amount: number) {
  target.set(currency, (target.get(currency) || 0) + amount);
}

function formatBreakdown(values: Map<string, number>) {
  return [...values.entries()]
    .filter(([, value]) => value !== 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, value]) => money(value, currency))
    .join(" · ") || money(0, "EUR");
}

function latestVersion(row: Record<string, unknown>) {
  const versions = Array.isArray(row.proposal_versions) ? row.proposal_versions as Record<string, unknown>[] : [];
  return [...versions].sort((a, b) => numeric(b.version_number) - numeric(a.version_number))[0] || null;
}

function proposalCurrency(row: Record<string, unknown>) {
  return String(relation(row.cases)?.currency || "EUR");
}

const caseLabels: Record<string, string> = {
  new_lead: "Nuevo", call_booked: "Llamada reservada", call_done: "Llamada realizada",
  budget_draft: "Presupuesto en preparación", proposal_sent: "Presupuesto enviado",
  proposal_accepted: "Presupuesto aceptado", contract_ready: "Contrato preparado",
  contract_signed: "Contrato firmado", payment_confirmed: "Pago confirmado",
  suppliers_pending: "Proveedores pendientes", ready_to_close: "Listo para cierre", closed: "Cerrado",
};

const purchaseLabels: Record<string, string> = {
  expected: "Pendiente", requested: "Solicitada", uploaded: "Documento recibido",
  holded_candidate: "Candidata en Holded", matched: "Conciliada", review_needed: "Revisión necesaria",
  approved: "Aprobada", not_required: "No necesaria", cancelled: "Cancelada",
};

export default async function ReportsPage() {
  const session = await requireAppPermission("reports.view");
  const [clientsResult, casesResult, proposalsResult, purchasesResult] = await Promise.all([
    listOrganizationClients(session.organizationId),
    listOrganizationCases(session.organizationId),
    listOrganizationProposals(session.organizationId),
    listOrganizationPurchases(session.organizationId),
  ]);

  const clients = asRows(clientsResult);
  const cases = asRows(casesResult);
  const proposals = asRows(proposalsResult);
  const purchases = asRows(purchasesResult);

  const activeCases = cases.filter((item) => String(item.status || "") !== "closed").length;
  const sentProposals = proposals.filter((item) => String(item.status || "") === "sent").length;
  const acceptedProposals = proposals.filter((item) => String(item.status || "") === "accepted");
  const openProposals = proposals.filter((item) => !["accepted", "rejected"].includes(String(item.status || "")));
  const pendingPurchases = purchases.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status || "")));

  const acceptedSale = new Map<string, number>();
  const acceptedCost = new Map<string, number>();
  const pipeline = new Map<string, number>();
  const expectedPurchases = new Map<string, number>();

  for (const proposal of acceptedProposals) {
    const currency = proposalCurrency(proposal);
    const version = latestVersion(proposal);
    addAmount(acceptedSale, currency, numeric(version?.total_sale));
    addAmount(acceptedCost, currency, numeric(version?.total_cost_budget ?? version?.total_cost));
  }
  for (const proposal of openProposals) addAmount(pipeline, proposalCurrency(proposal), numeric(latestVersion(proposal)?.total_sale));
  for (const purchase of purchases) addAmount(expectedPurchases, String(purchase.currency || relation(purchase.cases)?.currency || "EUR"), numeric(purchase.expected_amount ?? purchase.amount));

  const estimatedProfit = new Map<string, number>();
  const margins = new Map<string, number>();
  for (const [currency, sale] of acceptedSale) {
    const profit = sale - (acceptedCost.get(currency) || 0);
    estimatedProfit.set(currency, profit);
    margins.set(currency, sale > 0 ? (profit / sale) * 100 : 0);
  }
  const marginLabel = [...margins.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, value]) => `${currency} ${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`).join(" · ") || "—";

  const cards = [
    { label: "Clientes", value: clients.length, note: "Registrados", href: "/clientes" },
    { label: "Expedientes activos", value: activeCases, note: "Abiertos", href: "/expedientes" },
    { label: "Presupuestos enviados", value: sentProposals, note: "Pendientes de respuesta", href: "/propuestas" },
    { label: "Ventas aceptadas", value: formatBreakdown(acceptedSale), note: `${acceptedProposals.length} presupuestos`, href: "/propuestas" },
    { label: "Pipeline abierto", value: formatBreakdown(pipeline), note: "Separado por moneda", href: "/propuestas" },
    { label: "Compras pendientes", value: pendingPurchases.length, note: formatBreakdown(expectedPurchases), href: "/compras" },
    { label: "Beneficio previsto", value: formatBreakdown(estimatedProfit), note: "Sin mezclar monedas", href: "/informes" },
    { label: "Margen previsto", value: marginLabel, note: "Por moneda de expediente", href: "/informes" },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Informes"
        title="Informes operativos"
        description="Indicadores calculados desde la última versión de cada presupuesto y las compras reales, manteniendo separados los importes de monedas distintas."
      />

      <section className="client-kpis">
        {cards.map((card) => (
          <a className="kpi-card" href={card.href} key={card.label}>
            <span className="kpi-icon">{card.label.slice(0, 1)}</span>
            <span className="kpi-copy"><strong>{card.label}</strong><b>{card.value}</b><small>{card.note}</small></span>
          </a>
        ))}
      </section>

      <section className="dashboard-panels">
        <div className="card dashboard-table-card">
          <div className="panel-head"><h2>Expedientes recientes</h2><a className="btn secondary" href="/expedientes">Abrir expedientes</a></div>
          {cases.length === 0 ? <div className="empty-state"><h2>Todavía no hay expedientes</h2><p>Los informes aparecerán cuando empieces a crear expedientes reales.</p></div> : (
            <div className="table-scroll"><table>
              <thead><tr><th>Expediente</th><th>Destino</th><th>Moneda</th><th>Estado</th><th>Próxima acción</th></tr></thead>
              <tbody>{cases.slice(0, 8).map((item) => <tr key={String(item.id || item.case_code)}><td><strong>{String(item.case_code || "—")}</strong></td><td>{String(item.destination || "—")}</td><td>{String(item.currency || "EUR")}</td><td>{caseLabels[String(item.status)] || String(item.status || "—")}</td><td>{String(item.next_action || "—")}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>

        <div className="card dashboard-table-card">
          <div className="panel-head"><h2>Compras que requieren atención</h2><a className="btn secondary" href="/compras">Abrir compras</a></div>
          {pendingPurchases.length === 0 ? <div className="empty-state"><h2>No hay compras pendientes</h2><p>Las compras abiertas aparecerán aquí.</p></div> : (
            <div className="table-scroll"><table>
              <thead><tr><th>Expediente</th><th>Proveedor</th><th>Importe</th><th>Estado</th></tr></thead>
              <tbody>{pendingPurchases.slice(0, 8).map((item) => {
                const caseRow = relation(item.cases);
                const currency = String(item.currency || caseRow?.currency || "EUR");
                return <tr key={String(item.id)}><td>{String(caseRow?.case_code || "—")}</td><td><strong>{String(item.supplier_name || "Proveedor")}</strong><br/><small>{String(item.service || "—")}</small></td><td>{money(numeric(item.expected_amount ?? item.amount), currency)}</td><td>{purchaseLabels[String(item.status)] || String(item.status || "—")}</td></tr>;
              })}</tbody>
            </table></div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
