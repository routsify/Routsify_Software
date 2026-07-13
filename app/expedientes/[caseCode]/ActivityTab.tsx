"use client";

import { useState } from "react";
import type { TaskRow, TimelineRow } from "./workspace-types";
import { formatDateTime } from "./workspace-types";

const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En curso", done: "Completada", cancelled: "Cancelada" };

export function ActivityTab({ caseId, initialTasks = [], timeline = [] }: { caseId: string; initialTasks?: TaskRow[]; timeline?: TimelineRow[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function updateTask(taskId: string, status: string) {
    setBusyId(taskId); setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar la tarea."));
    setTasks((current) => current.map((task) => task.id === taskId ? result.data : task));
    setMessage("Tarea actualizada correctamente.");
  }

  return <section className="workspace-grid">
    <div className="card">
      <div className="panel-head"><div><h2>Tareas</h2><p>Acciones operativas vinculadas a este expediente.</p></div><span className="badge">{tasks.filter((task) => !["done", "cancelled"].includes(String(task.status))).length} abiertas</span></div>
      {message ? <p className="client-message" role="status">{message}</p> : null}
      {tasks.length ? <div className="client-task-list">{tasks.map((item) => <div className="client-task-item" key={item.id}><div><strong>{item.title || "Tarea"}</strong><small>{statusLabels[item.status || "pending"] || item.status} · {item.priority || "normal"} · {formatDateTime(item.due_at)}</small></div><div className="client-task-actions">{item.status === "pending" ? <button className="btn secondary" type="button" disabled={busyId === item.id} onClick={() => void updateTask(item.id, "in_progress")}>Iniciar</button> : null}{!["done", "cancelled"].includes(String(item.status)) ? <button className="btn" type="button" disabled={busyId === item.id} onClick={() => void updateTask(item.id, "done")}>{busyId === item.id ? "Guardando..." : "Completar"}</button> : null}</div></div>)}</div> : <p>No hay tareas.</p>}
    </div>
    <div className="card workspace-wide"><h2>Timeline</h2>{timeline.length ? <div className="timeline-list">{timeline.map((item) => <article key={item.id}><strong>{item.title || item.event_type || "Evento"}</strong><small>{formatDateTime(item.created_at)}</small></article>)}</div> : <p>No hay actividad registrada.</p>}</div>
  </section>;
}
