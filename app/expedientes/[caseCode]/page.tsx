import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { cases } from "@/lib/mock-data";
import { getDemoExpeditionState } from "@/lib/demo-expedition-engine";
import { formatCurrency, formatPercent } from "@/lib/budget";
import { formatBillingMoney } from "@/lib/billing";

export function generateStaticParams() {
  return cases.map((item) => ({ caseCode: item.case_code }));
}

export default async function CaseDetailPage({ params }: { params: Promise<{ caseCode: string }> }) {
  const { caseCode } = await params;
  const state = getDemoExpeditionState(decodeURIComponent(caseCode));
  if (!state) notFound();

  const latestEvent = state.timeline[state.timeline.length - 1];
  const mainContract = state.contracts[0];

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Expediente ${state.case.case_code}`}
        title={state.case.title}
        description="Pantalla central del viaje: estado, bloqueos, próxima acción, timeline, presupuesto, compras, viajeros, documentos, contrato, pago y cierre."
        action={<a className="btn" href="/hoy">Volver a Inicio</a>}
      />

      <section className="grid grid-3">
        <div className="card"><span className="badge">Estado actual</span><div className="metric">{state.case.status}</div><p>{state.nextAction}</p></div>
        <div className="card"><span className="badge">Cliente</span><div className="metric">{state.case.client}</div><p>{state.case.destination} · {state.case.trip_start} → {state.case.trip_end}</p></div>
        <div className="card"><span className="badge">Cierre</span><div className="metric">{state.canClose ? "ready" : "blocked"}</div><p>{state.blockers[0] || "Sin bloqueos operativos."}</p></div>
      </section>

      <section className="grid grid-3" style={{ marginTop: 18 }}>
        <div className="card"><span className="badge">Venta</span><div className="metric">{formatCurrency(state.sale)}</div><p>Margen previsto: {formatPercent(state.budgetTotals.margin)} · coste {formatCurrency(state.budgetTotals.totalCost)}.</p></div>
        <div className="card"><span className="badge">Pendiente de acción</span><div className="metric">{state.blockers.length}</div><p>{state.tasks.length} tareas · {state.docsPending} documentos · {state.purchasePending} compras.</p></div>
        <div className="card"><span className="badge">Último evento</span><div className="metric">{latestEvent.title}</div><p>{latestEvent.detail}</p></div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">Flujo de estados</div>
        <h2>Qué se ha completado y qué bloquea el avance</h2>
        <div className="workflow-steps">
          {state.stages.map((stage) => <div key={stage.key} className={`workflow-step ${stage.done ? "done" : ""} ${stage.blocked ? "blocked" : ""}`}><strong>{stage.label}</strong><small>{stage.action}</small></div>)}
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card"><div className="eyebrow">Bloqueos</div><h2>Qué impide avanzar</h2><table><thead><tr><th>Bloqueo</th><th>Acción</th></tr></thead><tbody>{state.blockers.length ? state.blockers.map((blocker) => <tr key={blocker}><td><strong>{blocker}</strong></td><td>Resolver en esta ficha del expediente.</td></tr>) : <tr><td colSpan={2}>Sin bloqueos.</td></tr>}</tbody></table></div>
        <div className="card"><div className="eyebrow">Timeline</div><h2>Historial visible</h2><div className="timeline">{state.timeline.map((item) => <div key={`${item.when}-${item.title}`}><strong>{item.when} · {item.title}</strong><p>{item.detail}</p></div>)}</div></div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">Áreas operativas del expediente</div>
        <h2>Sin módulos separados para viajeros, documentos, contrato ni pago</h2>
        <table><thead><tr><th>Área</th><th>Situación</th><th>Próxima acción</th><th>Ver</th></tr></thead><tbody>
          <tr><td>Presupuesto</td><td>{formatCurrency(state.budgetTotals.totalSale)} venta · {formatCurrency(state.budgetTotals.totalCost)} coste</td><td>Versionar, enviar, aceptar o bloquear snapshot.</td><td><a href="/propuestas">Abrir</a></td></tr>
          <tr><td>Compras</td><td>{state.purchasePending} compras pendientes</td><td>Reclamar proveedor, match Holded o justificar no requerida.</td><td><a href="/compras">Abrir</a></td></tr>
          <tr><td>Viajeros y documentos</td><td>{state.travelerStats.total} viajeros · {state.docsPending} documentos pendientes</td><td>Revisar documentación dentro del expediente.</td><td><a href="#viajeros-documentos">Ver aquí</a></td></tr>
          <tr><td>Contrato y pago</td><td>{state.signed ? "Contrato firmado" : "Firma pendiente"} · {formatBillingMoney(state.pendingPayment)} pendiente</td><td>Validar preflight, firma, cobro y evidencia.</td><td><a href="#contrato-pago">Ver aquí</a></td></tr>
          <tr><td>Notas</td><td>{state.communications.length} comunicaciones registradas</td><td>Mantener histórico dentro del expediente.</td><td><a href="#tareas-comunicaciones">Ver aquí</a></td></tr>
        </tbody></table>
      </section>

      <section id="viajeros-documentos" className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card"><div className="eyebrow">Viajeros</div><h2>Datos mínimos del viaje</h2><table><thead><tr><th>Viajero</th><th>Tipo</th><th>Caducidad</th><th>Estado</th></tr></thead><tbody>{state.travelers.length ? state.travelers.map((item) => <tr key={item.id}><td><strong>{item.full_name}</strong></td><td>{item.document_type || "pendiente"}</td><td>{item.document_expiry || "pendiente"}</td><td><span className="status-pill">{item.status}</span></td></tr>) : <tr><td colSpan={4}>Sin viajeros cargados.</td></tr>}</tbody></table></div>
        <div className="card"><div className="eyebrow">Documentos</div><h2>Archivos y revisión</h2><table><thead><tr><th>Documento</th><th>Tipo</th><th>Estado</th><th>Regla</th></tr></thead><tbody>{state.documents.length ? state.documents.map((item) => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.type}</td><td><span className="status-pill">{item.status}</span></td><td>{item.required ? "Obligatorio" : "Informativo"}</td></tr>) : <tr><td colSpan={4}>Sin documentos cargados.</td></tr>}</tbody></table></div>
      </section>

      <section id="contrato-pago" className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card"><div className="eyebrow">Contrato y firma</div><h2>Preflight contractual</h2>{mainContract ? <table><tbody><tr><th>Estado</th><td>{mainContract.status}</td></tr><tr><th>Importe</th><td>{formatBillingMoney(mainContract.amount)}</td></tr><tr><th>Archivo</th><td>{mainContract.document_file || "pendiente"}</td></tr><tr><th>Evidencia</th><td>{mainContract.signature_reference || mainContract.notes || mainContract.blocker || "pendiente"}</td></tr></tbody></table> : <p>No hay contrato generado todavía.</p>}</div>
        <div className="card"><div className="eyebrow">Pago y fiscalidad</div><h2>Cobros y documentos fiscales</h2><table><tbody><tr><th>Cobrado</th><td>{formatBillingMoney(state.received)}</td></tr><tr><th>Pendiente</th><td>{formatBillingMoney(state.pendingPayment)}</td></tr><tr><th>Pagos</th><td>{state.payments.length}</td></tr><tr><th>Documentos fiscales</th><td>{state.billingDocs.length}</td></tr></tbody></table></div>
      </section>

      <section id="tareas-comunicaciones" className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card"><div className="eyebrow">Tareas y comunicaciones</div><table><thead><tr><th>Tipo</th><th>Detalle</th><th>Responsable</th></tr></thead><tbody>{state.tasks.map((item) => <tr key={item.id}><td>Tarea</td><td>{item.title}<br/><small>{item.blocker || item.notes || item.status}</small></td><td>{item.owner}</td></tr>)}{state.communications.map((item) => <tr key={item.id}><td>{item.channel}</td><td>{item.subject}<br/><small>{item.summary}</small></td><td>{item.owner}</td></tr>)}</tbody></table></div>
        <div className="card"><div className="eyebrow">Resumen económico</div><table><tbody><tr><th>Venta</th><td>{formatCurrency(state.sale)}</td></tr><tr><th>Coste previsto</th><td>{formatCurrency(state.budgetTotals.totalCost)}</td></tr><tr><th>Margen previsto</th><td>{formatPercent(state.budgetTotals.margin)}</td></tr><tr><th>Cobrado</th><td>{formatBillingMoney(state.received)}</td></tr><tr><th>Pendiente</th><td>{formatBillingMoney(state.pendingPayment)}</td></tr></tbody></table></div>
      </section>
    </AppShell>
  );
}
