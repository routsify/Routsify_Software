"use client";

import { useMemo, useState } from "react";
import {
  canProcessIntegration,
  demoOutbox,
  integrationNextAction,
  integrationStatuses,
  integrationSummary,
  needsManualReview,
  scheduledJobs,
  OutboxItem,
} from "@/lib/integrations";
import { isDemoMode } from "@/lib/supabase-browser";

export function IntegrationsManager() {
  const [items, setItems] = useState<OutboxItem[]>(demoOutbox);
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => integrationSummary(items), [items]);

  function updateStatus(id: string, status: OutboxItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      status,
      attempts: status === "processing" ? item.attempts + 1 : item.attempts,
      last_attempt_at: status === "processing" ? new Date().toISOString().slice(0, 16).replace("T", " ") : item.last_attempt_at,
    } : item));
  }

  function retryFailed() {
    setItems((current) => current.map((item) => {
      if (item.status !== "failed") return item;
      if (needsManualReview(item)) return { ...item, status: "manual_review", next_action: item.next_action || "Resolver revisión manual antes de reintentar." };
      return { ...item, status: "pending", last_error: undefined };
    }));
    setMessage("Fallidos revisados: los que requieren criterio humano quedan en revisión manual; el resto vuelve a pendiente.");
  }

  function processItem(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    if (!canProcessIntegration(current)) {
      setItems((list) => list.map((item) => item.id === id ? { ...item, status: "manual_review", next_action: integrationNextAction(item) } : item));
      setMessage("No se procesa automáticamente: requiere revisión manual por riesgo, intentos o regla de negocio.");
      return;
    }
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "processing", attempts: item.attempts + 1, last_attempt_at: new Date().toISOString().slice(0, 16).replace("T", " ") } : item));
    setMessage("Evento marcado como procesando. En real lo haría una función de servidor y dejaría auditoría.");
  }

  function markDone(id: string) {
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "done", last_error: undefined, next_action: "Completado y trazado." } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Eventos</span><div className="metric">{summary.total}</div><p>Entradas en cola operativa.</p></div>
        <div className="card"><span className="badge">Revisión manual</span><div className="metric">{summary.manualReview}</div><p>{summary.highRisk} eventos de riesgo alto.</p></div>
        <div className="card"><span className="badge">Errores</span><div className="metric">{summary.failed}</div><p>{summary.pending} pendientes/procesando.</p></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Cola de integración</div>
            <h2>Outbox operativo</h2>
            <p>Primero se guarda el evento. Después se procesa con reglas, reintentos, revisión humana y trazabilidad.</p>
            {message ? <p>{message}</p> : null}
          </div>
          <button className="btn secondary" type="button" onClick={retryFailed}>Revisar fallidos</button>
        </div>
        <table>
          <thead><tr><th>Canal</th><th>Evento</th><th>Expediente</th><th>Estado</th><th>Riesgo</th><th>Intentos</th><th>Regla</th><th>Acción</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td><span className="badge">{item.channel}</span></td><td><strong>{item.event_type}</strong><br/><small>{item.created_at}</small></td><td>{item.related_case ? <a href={`/expedientes/${item.related_case}`}>{item.related_case}</a> : "—"}</td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as OutboxItem["status"])}>{integrationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td><span className="badge">{item.risk || "low"}</span></td><td>{item.attempts}/{item.max_attempts ?? 3}<br/><small>{item.last_attempt_at || "sin intento"}</small></td><td>{item.business_rule || item.payload_summary}<br/><small>{item.last_error || integrationNextAction(item)}</small></td><td><button className="btn secondary" type="button" onClick={() => processItem(item.id)}>Procesar</button><br/><button className="btn secondary" type="button" onClick={() => markDone(item.id)} style={{ marginTop: 8 }}>Hecho</button></td></tr>)}</tbody>
        </table>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Jobs programados</div>
          <h2>Controles recurrentes</h2>
          <table><thead><tr><th>Job</th><th>Cadencia</th><th>Owner</th><th>Activo</th></tr></thead><tbody>{scheduledJobs.map((job) => <tr key={job.id}><td><strong>{job.name}</strong><br/><small>{job.purpose}</small></td><td>{job.cadence}<br/><small>{job.last_run_at || job.next_run_hint || "sin ejecución"}</small></td><td>{job.owner || "Equipo"}</td><td>{job.enabled ? "Sí" : "No"}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <div className="eyebrow">Regla de seguridad</div>
          <h2>Automatización conservadora</h2>
          <p>Los eventos críticos de fiscalidad, pagos y proveedor no se disparan sin validación. El navegador solo muestra estado operativo.</p>
          <table><tbody><tr><th>Modo actual</th><td>{isDemoMode() ? "Demo" : "Supabase"}</td></tr><tr><th>Entradas</th><td>Formulario, booking y pagos manuales</td></tr><tr><th>Salidas</th><td>Fiscalidad y proveedores con revisión</td></tr><tr><th>Reintentos</th><td>Limitados y con parada en revisión manual</td></tr></tbody></table>
        </div>
      </section>
    </div>
  );
}
