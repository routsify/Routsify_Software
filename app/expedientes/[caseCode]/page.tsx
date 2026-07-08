import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { cases, budgetLines, expectedPurchases } from "@/lib/mock-data";
import { demoTravelers, travelerSummary } from "@/lib/travelers";
import { demoContracts, contractSummary, formatContractMoney } from "@/lib/contracts";
import { demoPayments, demoBillingDocuments, billingSummary, formatBillingMoney } from "@/lib/billing";
import { demoTasks } from "@/lib/tasks";
import { demoDocuments } from "@/lib/documents";
import { demoCommunications } from "@/lib/communications";
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
  const caseBillingDocs = demoBillingDocuments.filter((item) => item.case_code === currentCase.case_code);
  const caseTasks = demoTasks.filter((item) => item.case_code === currentCase.case_code && item.status !== "done");
  const caseFiles = demoDocuments.filter((item) => item.case_code === currentCase.case_code);
  const caseComms = demoCommunications.filter((item) => item.case_code === currentCase.case_code);

  const travelerStats = travelerSummary(caseTravelers);
  const contractStats = contractSummary(caseContracts);
  const billingStats = billingSummary(casePayments, caseBillingDocs);
  const budgetTotals = calculateBudgetTotals(budgetLines);
  const purchasePending = casePurchases.filter((item) => item.status !== "approved").length;
  const docsPending = caseFiles.filter((item) => item.status === "missing" || item.status === "expired" || item.status === "reviewing").length;
  const openComms = caseComms.filter((item) => item.status === "open" || item.status === "waiting").length;
  const saleValue = currentCase.accepted_value || budgetTotals.totalSale;
  const canClose = travelerStats.ready && contractStats.blocked === 0 && purchasePending === 0 && billingStats.pending === 0 && docsPending === 0;
  const latestEvent = caseComms[0]?.subject || currentCase.next_action || "Sin evento reciente";

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Expediente ${currentCase.case_code}`}
        title={currentCase.title}
        description="Vista 360 para operar el expediente desde un solo lugar: estado, tarea, comunicación, documentación, presupuesto, compras, contrato, pagos y cierre."
        action={<a className="btn" href="/hoy">Volver a Hoy</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Estado</span><div className="metric">{currentCase.status}</div><p>{currentCase.next_action}</p></div>
        <div className="card"><span className="badge">Cliente</span><div className="metric">{currentCase.client}</div><p>{currentCase.destination} · {currentCase.trip_start} → {currentCase.trip_end}</p></div>
        <div className="card"><span className="badge">Cierre</span><div className="metric">{canClose ? "ready" : "blocked"}</div><p>{currentCase.blocker || "Sin bloqueo comercial visible."}</p></div>
      </section>

      <section className="grid grid-3" style={{ marginTop: 18 }}>
        <div className="card"><span className="badge">Venta propuesta</span><div className="metric">{formatCurrency(saleValue)}</div><p>Margen demo: {formatPercent(budgetTotals.margin)}</p></div>
        <div className="card"><span className="badge">Trabajo abierto</span><div className="metric">{caseTasks.length + docsPending + purchasePending + openComms}</div><p>{caseTasks.length} tareas · {docsPending} documentos · {purchasePending} compras · {openComms} seguimientos.</p></div>
        <div className="card"><span className="badge">Último evento</span><div className="metric">{latestEvent}</div><p>Referencia rápida para saber por dónde retomar el expediente.</p></div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">Operativa integrada</div>
        <h2>Qué hacer ahora en este expediente</h2>
        <table>
          <thead><tr><th>Área</th><th>Situación</th><th>Acción sugerida</th><th>Ir</th></tr></thead>
          <tbody>
            <tr><td>Presupuesto</td><td>{formatCurrency(budgetTotals.totalSale)} venta demo · {formatCurrency(budgetTotals.totalCost)} coste</td><td>Revisar margen y versión antes de enviar o aceptar.</td><td><a href="/propuestas">Abrir</a></td></tr>
            <tr><td>Viajeros</td><td>{travelerStats.ready ? "Documentación lista" : `${travelerStats.missing} faltan · ${travelerStats.expired} caducados`}</td><td>{travelerStats.ready ? "Puede avanzar a contrato." : "Solicitar documentación antes de contrato."}</td><td><a href="/viajeros">Abrir</a></td></tr>
            <tr><td>Contrato</td><td>{caseContracts[0]?.status || "pendiente"}</td><td>{contractStats.blocked ? "Resolver bloqueos documentales antes de firma." : "Preparar o marcar firma."}</td><td><a href="/contratos">Abrir</a></td></tr>
            <tr><td>Pagos</td><td>{formatBillingMoney(billingStats.received)} cobrado · {formatBillingMoney(billingStats.pending)} pendiente</td><td>Confirmar pago antes de fiscalidad y cierre.</td><td><a href="/facturacion">Abrir</a></td></tr>
            <tr><td>Compras</td><td>{purchasePending} pendientes de aprobar</td><td>Reclamar, subir o validar factura proveedor.</td><td><a href="/compras">Abrir</a></td></tr>
          </tbody>
        </table>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Tareas abiertas</div>
          <table><thead><tr><th>Tarea</th><th>Responsable</th><th>Prioridad</th><th>Vence</th></tr></thead><tbody>{caseTasks.length ? caseTasks.map((item) => <tr key={item.id}><td>{item.title}<br/><small>{item.blocker || item.notes || item.status}</small></td><td>{item.owner}</td><td><span className="badge">{item.priority}</span></td><td>{item.due_date || "—"}</td></tr>) : <tr><td colSpan={4}>Sin tareas abiertas.</td></tr>}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Comunicaciones</div>
          <table><thead><tr><th>Contacto</th><th>Asunto</th><th>Estado</th><th>Seguimiento</th></tr></thead><tbody>{caseComms.length ? caseComms.map((item) => <tr key={item.id}><td>{item.contact}<br/><small>{item.channel}</small></td><td>{item.subject}<br/><small>{item.summary}</small></td><td><span className="badge">{item.status}</span></td><td>{item.follow_up_at || item.created_at}</td></tr>) : <tr><td colSpan={4}>Sin comunicaciones registradas.</td></tr>}</tbody></table>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Documentos</div>
          <table><thead><tr><th>Tipo</th><th>Documento</th><th>Archivo</th><th>Estado</th></tr></thead><tbody>{caseFiles.length ? caseFiles.map((item) => <tr key={item.id}><td><span className="badge">{item.type}</span></td><td>{item.title}<br/><small>{item.expires_at ? `Caduca ${item.expires_at}` : item.uploaded_at || "sin subida"}</small></td><td>{item.file_name || "—"}</td><td><span className="badge">{item.status}</span></td></tr>) : <tr><td colSpan={4}>Sin documentos registrados.</td></tr>}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Viajeros</div>
          <table><thead><tr><th>Nombre</th><th>Documento</th><th>Estado</th></tr></thead><tbody>{caseTravelers.length ? caseTravelers.map((item) => <tr key={item.id}><td>{item.full_name}</td><td>{item.document_type}<br/><small>{item.document_expiry || "sin caducidad"}</small></td><td><span className="badge">{item.status}</span></td></tr>) : <tr><td colSpan={3}>Sin viajeros registrados.</td></tr>}</tbody></table>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Compras proveedor</div>
          <table><thead><tr><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{casePurchases.length ? casePurchases.map((item) => <tr key={`${item.supplier}-${item.service}`}><td>{item.supplier}</td><td>{item.service}</td><td><span className="badge">{item.status}</span></td><td>{item.amount.toLocaleString("es-ES")} €</td></tr>) : <tr><td colSpan={4}>Sin compras esperadas para este expediente.</td></tr>}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Contrato, pagos y documentos fiscales</div>
          <table><tbody><tr><th>Contrato</th><td>{caseContracts[0] ? `${caseContracts[0].status} · ${formatContractMoney(caseContracts[0].amount, caseContracts[0].currency)}` : "pendiente"}</td></tr><tr><th>Cobrado</th><td>{formatBillingMoney(billingStats.received)}</td></tr><tr><th>Pendiente</th><td>{formatBillingMoney(billingStats.pending)}</td></tr><tr><th>Documentos fiscales</th><td>{caseBillingDocs.length} · {billingStats.documentsSynced} sincronizados</td></tr></tbody></table>
        </div>
      </section>
    </AppShell>
  );
}
