"use client";

import { useMemo, useState } from "react";
import { closeSummary, defaultCloseChecks } from "@/lib/close";
import { isDemoMode } from "@/lib/supabase-browser";

export function CloseManager() {
  const [checks, setChecks] = useState(defaultCloseChecks);
  const summary = useMemo(() => closeSummary(checks), [checks]);

  function toggleCheck(id: string) {
    setChecks((current) => current.map((check) => check.id === id ? { ...check, done: !check.done } : check));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Progreso</span><div className="metric">{summary.progress}%</div><p>{summary.done}/{summary.total} checks completados.</p></div>
        <div className="card"><span className="badge">Bloqueos</span><div className="metric">{summary.blockingOpen}</div><p>Checks bloqueantes pendientes.</p></div>
        <div className="card"><span className="badge">Estado sugerido</span><div className="metric">{summary.status}</div><p>{isDemoMode() ? "Modo demo" : "Supabase real"}</p></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Checklist de cierre</div>
            <h2>Antes de cerrar expediente</h2>
            <p>Un expediente solo debería pasar a cerrado cuando no quedan bloqueos de contrato, pago ni facturas proveedor.</p>
          </div>
          <a className="btn secondary" href="/compras">Revisar compras</a>
        </div>
        <table>
          <thead><tr><th>Hecho</th><th>Control</th><th>Descripción</th><th>Tipo</th></tr></thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.id}>
                <td><input type="checkbox" checked={check.done} onChange={() => toggleCheck(check.id)} /></td>
                <td><strong>{check.label}</strong></td>
                <td>{check.description}</td>
                <td><span className="badge">{check.blocking ? "bloqueante" : "informativo"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Decisión</div>
          <h2>{summary.status === "ready_to_close" ? "Listo para cierre operativo" : "No cerrar todavía"}</h2>
          <p>{summary.status === "ready_to_close" ? "No quedan bloqueos críticos. Se puede preparar factura final/regularización y cierre." : "Todavía hay bloqueos críticos. Mantén el expediente abierto y asigna próxima acción."}</p>
        </div>
        <div className="card">
          <div className="eyebrow">Próximo paso lógico</div>
          <h2>{summary.blockingOpen > 0 ? "Resolver bloqueos" : "Cerrar y auditar"}</h2>
          <p>{summary.blockingOpen > 0 ? "Prioriza contrato, pago y facturas proveedor. Después actualiza el expediente a ready_to_close." : "Registrar cierre, guardar notas finales y preparar regularización fiscal si corresponde."}</p>
        </div>
      </section>
    </div>
  );
}
