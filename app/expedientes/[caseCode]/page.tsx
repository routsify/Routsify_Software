import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { cases, budgetLines, expectedPurchases } from "@/lib/mock-data";
import { demoTravelers, travelerSummary } from "@/lib/travelers";
import { demoContracts, contractSummary, formatContractMoney } from "@/lib/contracts";
import { demoPayments, demoBillingDocuments, billingSummary, formatBillingMoney } from "@/lib/billing";
import { calculateBudgetTotals, formatCurrency, formatPercent } from "@/lib/budget";

export function generateStaticParams() {
  return cases.map((item) => ({ caseCode: item.case_code }));
}

export default async function CaseDetailPage({ params }: { params: Promise<{ caseCode: string }> }) {
  const { caseCode } = await params;
  const currentCase = cases.find((item) => item.case_code === decodeURIComponent(caseCode));
  if (!currentCase) notFound();

  const casePurchases = expectedPurchases.filter((item) => item.case_code === currentCase.case_code);
  const caseTravelers = demoTravelers.filter((item) => item.case_code === currentCase.case_code);
  const caseContracts = demoContracts.filter((item) => item.case_code === currentCase.case_code);
  const casePayments = demoPayments.filter((item) => item.case_code === currentCase.case_code);
  const caseDocs = demoBillingDocuments.filter((item) => item.case_code === currentCase.case_code);
  const travelerStats = travelerSummary(caseTravelers);
  const contractStats = contractSummary(caseContracts);
  const billingStats = billingSummary(casePayments, caseDocs);
  const budgetTotals = calculateBudgetTotals(budgetLines);
  const purchasePending = casePurchases.filter((item) => item.status !== "approved").length;
  const canClose = travelerStats.ready && contractStats.blocked === 0 && purchasePending === 0 && billingStats.pending === 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Expediente ${currentCase.case_code}`}
        title={currentCase.title}
        description="Vista 360 del expediente: cliente, propuesta, viajeros, contrato, compras, pagos y cierre operativo."
        action={<a className="btn" href="/expedientes">Volver a expedientes</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Estado</span><div className="metric">{currentCase.status}</div><p>{currentCase.next_action}</p></div>
        <div className="card"><span className="badge">Cliente</span><div className="metric">{currentCase.client}</div><p>{currentCase.destination} · {currentCase.trip_start} → {currentCase.trip_end}</p></div>
        <div className="card"><span className="badge">Cierre</span><div className="metric">{canClose ? "ready" : "blocked"}</div><p>{currentCase.blocker || "Sin bloqueo comercial visible."}</p></div>
      </section>

      <section className="grid grid-3" style={{ marginTop: 18 }}>
        <div className="card"><span className="badge">Venta propuesta</span><div className="metric">{formatCurrency(currentCase.accepted_value || budgetTotals.sale)}</div><p>Margen demo: {formatPercent(budgetTotals.marginRate)}</p></div>
        <div className="card"><span className="badge">Viajeros</span><div className="metric">{travelerStats.ready ? "ready" : "blocked"}</div><p>{caseTravelers.length} viajeros · {travelerStats.missing} faltantes · {travelerStats.expired} caducados.</p></div>
        <div className="card"><span className="badge">Pagos</span><div className="metric">{formatBillingMoney(billingStats.received)}</div><p>{formatBillingMoney(billingStats.pending)} pendiente.</p></div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Acciones rápidas</div><h2>Trabajar este expediente</h2><p>Accesos a las áreas que componen el expediente.</p></div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn secondary" href="/viajeros">Viajeros</a>
          <a className="btn secondary" href="/propuestas">Presupuesto</a>
          <a className="btn secondary" href="/contratos">Contratos</a>
          <a className="btn secondary" href="/compras">Compras</a>
          <a className="btn secondary" href="/facturacion">Pagos y facturación</a>
          <a className="btn secondary" href="/cierre">Cierre</a>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Compras proveedor</div>
          <table><thead><tr><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{casePurchases.length ? casePurchases.map((item) => <tr key={`${item.supplier}-${item.service}`}><td>{item.supplier}</td><td>{item.service}</td><td><span className="badge">{item.status}</span></td><td>{item.amount.toLocaleString("es-ES")} €</td></tr>) : <tr><td colSpan={4}>Sin compras esperadas para este expediente.</td></tr>}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Contrato</div>
          <table><thead><tr><th>Versión</th><th>Estado</th><th>Importe</th><th>Notas</th></tr></thead><tbody>{caseContracts.length ? caseContracts.map((item) => <tr key={item.id}><td>{item.proposal_version}</td><td><span className="badge">{item.status}</span></td><td>{formatContractMoney(item.amount, item.currency)}</td><td>{item.blocker || item.notes || "—"}</td></tr>) : <tr><td colSpan={4}>Contrato pendiente.</td></tr>}</tbody></table>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Viajeros</div>
          <table><thead><tr><th>Nombre</th><th>Documento</th><th>Estado</th></tr></thead><tbody>{caseTravelers.length ? caseTravelers.map((item) => <tr key={item.id}><td>{item.full_name}</td><td>{item.document_type}<br/><small>{item.document_expiry || "sin caducidad"}</small></td><td><span className="badge">{item.status}</span></td></tr>) : <tr><td colSpan={3}>Sin viajeros registrados.</td></tr>}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Pagos y documentos</div>
          <table><tbody><tr><th>Cobrado</th><td>{formatBillingMoney(billingStats.received)}</td></tr><tr><th>Pendiente</th><td>{formatBillingMoney(billingStats.pending)}</td></tr><tr><th>Documentos fiscales</th><td>{caseDocs.length}</td></tr><tr><th>Sincronizados</th><td>{billingStats.documentsSynced}</td></tr></tbody></table>
        </div>
      </section>
    </AppShell>
  );
}
