"use client";

import { useMemo, useState } from "react";
import { communicationStatuses, communicationSummary, demoCommunications, CommunicationItem } from "@/lib/communications";

export function CommunicationsManager() {
  const [items, setItems] = useState<CommunicationItem[]>(demoCommunications);
  const [query, setQuery] = useState("");
  const summary = useMemo(() => communicationSummary(items), [items]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => [item.case_code, item.channel, item.contact, item.subject, item.owner, item.status].some((value) => String(value).toLowerCase().includes(normalized)));
  }, [items, query]);

  function updateStatus(id: string, status: CommunicationItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Comunicaciones</span><div className="metric">{summary.total}</div><p>Historial demo de cliente, proveedor y equipo.</p></div>
        <div className="card"><span className="badge">Abiertas</span><div className="metric">{summary.open}</div><p>Requieren seguimiento operativo.</p></div>
        <div className="card"><span className="badge">Esperando</span><div className="metric">{summary.waiting}</div><p>Bloqueadas por respuesta externa.</p></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Historial de contacto</div>
            <h2>Conversaciones por expediente</h2>
            <p>Registra llamadas, reuniones, emails, notas internas y notas de proveedor para no perder contexto.</p>
          </div>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar comunicación" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <table>
          <thead><tr><th>Expediente</th><th>Canal</th><th>Contacto</th><th>Asunto</th><th>Responsable</th><th>Seguimiento</th><th>Estado</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td><span className="badge">{item.channel}</span><br/><small>{item.direction}</small></td><td>{item.contact}</td><td>{item.subject}<br/><small>{item.summary}</small></td><td>{item.owner}</td><td>{item.follow_up_at || item.created_at}</td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as CommunicationItem["status"])}>{communicationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody>
        </table>
      </section>

      <section className="card">
        <div className="eyebrow">Regla operativa</div>
        <h2>Todo bloqueo debe tener próximo contacto</h2>
        <p>Cuando una tarea, documento, pago o proveedor se queda esperando, debe existir una comunicación asociada con responsable y fecha de seguimiento.</p>
      </section>
    </div>
  );
}
