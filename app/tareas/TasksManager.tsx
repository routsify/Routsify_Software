"use client";

import { useMemo, useState } from "react";
import { demoTasks, taskStatuses, taskSummary, TaskItem } from "@/lib/tasks";

export function TasksManager() {
  const [items, setItems] = useState<TaskItem[]>(demoTasks);
  const summary = useMemo(() => taskSummary(items), [items]);

  function updateStatus(id: string, status: TaskItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Abiertas</span><div className="metric">{summary.open}</div><p>{summary.total} tareas totales.</p></div>
        <div className="card"><span className="badge">Urgentes</span><div className="metric">{summary.urgent}</div><p>Acciones críticas del día.</p></div>
        <div className="card"><span className="badge">Bloqueadas</span><div className="metric">{summary.blocked}</div><p>Necesitan decisión o respuesta externa.</p></div>
      </section>

      <section className="card">
        <div className="eyebrow">Cola operativa</div>
        <h2>Tareas por expediente</h2>
        <p>Una lista común para que ventas, operaciones y facturación no pierdan acciones críticas.</p>
        <table>
          <thead><tr><th>Expediente</th><th>Tarea</th><th>Área</th><th>Responsable</th><th>Vence</th><th>Prioridad</th><th>Estado</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td>{item.title}<br/><small>{item.blocker || item.notes || "—"}</small></td><td>{item.area}</td><td>{item.owner}</td><td>{item.due_date || "—"}</td><td><span className="badge">{item.priority}</span></td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as TaskItem["status"])}>{taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
