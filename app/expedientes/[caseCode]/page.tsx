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

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Expediente ${state.case.case_code}`}
        title={state.case.title}
        description="Pantalla central del viaje: estado, bloqueos, próxima acción, timeline, presupuesto, compras, viajeros, contrato, pago, documentos y cierre."
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
        <div className="card">
          <div className="eyebrow">Bloqueos</div>
          <h2>Qué impide avanzar</h2>
          <table><thead><tr><th>Bloqueo</th><th>Acción</th></tr></thead><tbody>{state.blockers.length ? state.blockers.map((blocker) => <tr key={blocker}><td><strong>{blocker}</strong></td><td>Resolver desde el módulo relacionado y volver al expediente.</td></tr>) : <tr><td colSpan={2}>Sin bloqueos. Puede revisarse cierre operativo.</td></tr>}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Timeline</div>
          <h2>Historial visible</h2>
          <div className="timeline">{state.timeline.map((item) => <div key={`${item.when}-${item.title}`}><strong>{item.when} · {item.title}</strong><p>{item.detail}</p></div>)}</div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">Tabs operativos del expediente</div>
        <h2>Todo cuelga del expediente</h2>
        <table>
          <thead><tr><th>Área</th><th>Situación</th><th>Próxima acción</th><th>Ir</th></tr></thead>
          <tbody>
            <tr><td>Presupuesto</td><td>{formatCurrency(state.budgetTotals.totalSale)} venta · {formatCurrency(state.budgetTotals.totalCost)} coste</td><td>Versionar, enviar, aceptar o bloquear snapshot.</td><td><a href="/propuestas">Abrir</a></td></tr>
            <tr><td>Compras</td><td>{state.purchasePending} compras pendientes</td><td>Reclamar proveedor, match Holded o justificar no requerida.</td><td><a href="/compras">Abrir</a></td></tr>
            <tr><td>Viajeros</td><td>{state.travelerStats.ready ? "Documentación aprobada" : `${state.travelerStats.missing} faltan · ${state.travelerStats.expired} caducados`}</td><td>OCR demo, revisión humana y aprobación documental.</td><td><a href="/viajeros">Abrir</a></td></tr>
            <tr><td>Contrato</td><td>{state.signed ? "Firmado" : "Sin firma"}</td><td>Preflight, generar/enviar contrato y guardar evidencia de firma.</td><td><a href="/contratos">Abrir</a></td></tr>
            <tr><td>Pago</td><td>{formatBillingMoney(state.received)} cobrado · {formatBillingMoney(state.pendingPayment)} pendiente</td><td>Confirmar cobro con referencia única y disparar fiscalidad demo.</td><td><a href="/contratos">Abrir</a></td></tr>
            <tr><td>Documentos</td><td>{state.docsPending} documentos requieren acción</td><td>Aprobar, rechazar o solicitar archivo privado.</td><td><a href="/viajeros">Abrir</a></td></tr>
            <tr><td>Notas</td><td>{state.communications.length} comunicaciones registradas</td><td>Mantener el histórico dentro del expediente.</td><td><a href="/expedientes">Abrir</a></td></tr>
          </tbody>
        </table>
      </section>

      <section className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">Tareas y comunicaciones</div>
          <table><thead><tr><th>Tipo</th><th>Detalle</th><th>Responsable</th></tr></thead><tbody>{state.tasks.map((item) => <tr key={item.id}><td>Tarea</td><td>{item.title}<br/><small>{item.blocker || item.notes || item.status}</small></td><td>{item.owner}</td></tr>)}{state.communications.map((item) => <tr key={item.id}><td>{item.channel}</td><td>{item.subject}<br/><small>{item.summary}</small></td><td>{item.owner}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Resumen económico</div>
          <table><tbody><tr><th>Venta</th><td>{formatCurrency(state.sale)}</td></tr><tr><th>Coste previsto</th><td>{formatCurrency(state.budgetTotals.totalCost)}</td></tr><tr><th>Margen previsto</th><td>{formatPercent(state.budgetTotals.margin)}</td></tr><tr><th>Cobrado</th><td>{formatBillingMoney(state.received)}</td></tr><tr><th>Pendiente</th><td>{formatBillingMoney(state.pendingPayment)}</td></tr></tbody></table>
        </div>
      </section>
    </AppShell>
  );
}
