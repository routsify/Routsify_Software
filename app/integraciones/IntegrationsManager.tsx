"use client";

import { useMemo, useState } from "react";
import {
  demoOutbox,
  integrationStatuses,
  integrationSummary,
  scheduledJobs,
  OutboxItem,
} from "@/lib/integrations";
import { isDemoMode } from "@/lib/supabase-browser";

export function IntegrationsManager() {
  const [items, setItems] = useState<OutboxItem[]>(demoOutbox);
  const summary = useMemo(() => integrationSummary(items), [items]);

  function updateStatus(id: string, status: OutboxItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status, attempts: status === "processing" ? item.attempts + 1 : item.attempts } : item));
  }

  function retryFailed() {
    setItems((current) => current.map((item) => item.status === "failed" ? { ...item, status: "pending", last_error: undefined } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Eventos</span><div className="metric">{summary.total}</div><p>Entradas en cola operativa.</p></div>
        <div className="card"><span className="badge">Pendientes</span><div className="metric">{summary.pending}</div><p>Eventos por procesar o revisar.</p></div>
        <div className="card"><span className="badge">Errores</span><div className="metric">{summary.failed}</div><p>Necesitan revisión humana.</p></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Cola de integración</div>
            <h2>Outbox operativo</h2>
            <p>La app no debe depender de automatismos frágiles. Primero guarda el evento, después se procesa con control, reintentos y auditoría.</p>
          </div>
          <button className="btn secondary" type="button" onClick={retryFailed}>Reintentar fallidos</button>
        </div>
        <table>
          <thead><tr><th>Canal</th><th>Evento</th><th>Expediente</th><th>Estado</th><th>Intentos</th><th>Resumen</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><span className="badge">{item.channel}</span></td>
                <td><strong>{item.event_type}</strong><br/><small>{item.created_at}</small></td>
                <td>{item.related_case || "—"}</td>
                <td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as OutboxItem["status"])}>{integrationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                <td>{item.attempts}</td>
                <td>{item.payload_summary}{item.last_error ? <><br/><small>{item.last_error}</small></> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Jobs programados</div>
          <h2>Controles recurrentes</h2>
          <table>
            <thead><tr><th>Job</th><th>Cadencia</th><th>Activo</th></tr></thead>
            <tbody>{scheduledJobs.map((job) => <tr key={job.id}><td><strong>{job.name}</strong><br/><small>{job.purpose}</small></td><td>{job.cadence}</td><td>{job.enabled ? "Sí" : "No"}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <div className="eyebrow">Regla de seguridad</div>
          <h2>Secretos fuera del frontend</h2>
          <p>Los webhooks, claves privadas y sincronizaciones de terceros deben ejecutarse en funciones de servidor. El navegador solo muestra estado operativo.</p>
          <table>
            <tbody>
              <tr><th>Modo actual</th><td>{isDemoMode() ? "Demo" : "Supabase"}</td></tr>
              <tr><th>Formularios</th><td>Webhook de entrada</td></tr>
              <tr><th>Booking</th><td>API propia / webhook</td></tr>
              <tr><th>Pagos</th><td>Manual al inicio</td></tr>
              <tr><th>Fiscal</th><td>Sincronización conservadora</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
