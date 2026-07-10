import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listCasesRepository, listClientsRepository, listProposalsRepository, listPurchasesRepository } from "@/lib/server-repositories";

function asRows(result: { ok: boolean; data?: unknown[] }) {
  return result.ok && Array.isArray(result.data) ? result.data as Record<string, unknown>[] : [];
}

function money(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function numeric(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function proposalVersions(row: Record<string, unknown>) {
  return Array.isArray(row.proposal_versions) ? row.proposal_versions as Record<string, unknown>[] : [];
}

function proposalTotal(row: Record<string, unknown>, key: "total_sale" | "total_cost") {
  return proposalVersions(row).reduce((sum, version) => sum + numeric(version[key]), 0);
}

export default async function ReportsPage() {
  const [clientsResult, casesResult, proposalsResult, purchasesResult] = await Promise.all([
    listClientsRepository(),
    listCasesRepository(),
    listProposalsRepository(),
    listPurchasesRepository(),
  ]);

  const clients = asRows(clientsResult);
  const cases = asRows(casesResult);
  const proposals = asRows(proposalsResult);
  const purchases = asRows(purchasesResult);

  const activeCases = cases.filter((item) => !["closed", "cerrado"].includes(String(item.status || ""))).length;
  const sentProposals = proposals.filter((item) => ["sent", "internal_review"].includes(String(item.status || ""))).length;
  const acceptedProposals = proposals.filter((item) => ["accepted", "aceptado"].includes(String(item.status || ""))).length;
  const pendingPurchases = purchases.filter((item) => !["received", "not_required", "cancelled"].includes(String(item.status || ""))).length;
  const totalSale = proposals.reduce((sum, item) => sum + proposalTotal(item, "total_sale"), 0);
  const totalCost = proposals.reduce((sum, item) => sum + proposalTotal(item, "total_cost"), 0);
  const estimatedProfit = Math.max(0, totalSale - totalCost);
  const margin = totalSale > 0 ? (estimatedProfit / totalSale) * 100 : 0;

  const cards = [
    { label: "Clientes", value: clients.length, note: "Registrados", href: "/clientes" },
    { label: "Expedientes activos", value: activeCases, note: "Abiertos", href: "/expedientes" },
    { label: "Presupuestos enviados", value: sentProposals, note: "Pendientes de respuesta", href: "/propuestas" },
    { label: "Presupuestos aceptados", value: acceptedProposals, note: "Cerrados como venta", href: "/propuestas" },
    { label: "Compras pendientes", value: pendingPurchases, note: "Por revisar", href: "/compras" },
    { label: "Valor presupuestado", value: money(totalSale), note: "Según versiones", href: "/propuestas" },
    { label: "Beneficio previsto", value: money(estimatedProfit), note: "Venta menos coste", href: "/informes" },
    { label: "Margen previsto", value: `${margin.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`, note: "Sobre precio de venta", href: "/informes" },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Informes"
        title="Informes operativos"
        description="Resumen real de clientes, expedientes, presupuestos y compras. Los gráficos avanzados se activarán cuando exista histórico suficiente."
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
            <table>
              <thead><tr><th>Expediente</th><th>Destino</th><th>Estado</th><th>Próxima acción</th></tr></thead>
              <tbody>{cases.slice(0, 8).map((item) => <tr key={String(item.id || item.case_code)}><td><strong>{String(item.case_code || "—")}</strong></td><td>{String(item.destination || "—")}</td><td>{String(item.status || "—")}</td><td>{String(item.next_action || "—")}</td></tr>)}</tbody>
            </table>
          )}
        </div>

        <div className="card dashboard-table-card">
          <div className="panel-head"><h2>Compras pendientes</h2><a className="btn secondary" href="/compras">Abrir compras</a></div>
          {purchases.length === 0 ? <div className="empty-state"><h2>Todavía no hay compras</h2><p>Las compras aparecerán al crear presupuestos y líneas operativas.</p></div> : (
            <table>
              <thead><tr><th>Proveedor</th><th>Servicio</th><th>Importe</th><th>Estado</th></tr></thead>
              <tbody>{purchases.slice(0, 8).map((item) => <tr key={String(item.id)}><td><strong>{String(item.supplier_name || "Proveedor")}</strong></td><td>{String(item.service || "—")}</td><td>{money(numeric(item.amount))}</td><td>{String(item.status || "—")}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
