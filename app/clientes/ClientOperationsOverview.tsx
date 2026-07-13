"use client";

import { useMemo, useState } from "react";

type ClientRow = { id?: string; display_name?: string; email?: string | null; phone?: string | null };
type LeadRow = { id?: string; client_id?: string | null; source?: string; status?: string; destination?: string | null; travel_start?: string | null; travel_end?: string | null; travelers?: number | null; budget_hint?: number | string | null; created_at?: string | null };
type BookingRow = { id?: string; client_id?: string | null; starts_at?: string | null; ends_at?: string | null; status?: string; source?: string; created_at?: string | null };
type TaskRow = { id?: string; client_id?: string | null; case_id?: string | null; title?: string; status?: string; priority?: string; due_at?: string | null; payload?: Record<string, unknown> | null };
type CaseRow = { id?: string; client_id?: string | null; case_code?: string; status?: string; destination?: string | null };

function text(value: unknown) { return String(value || "").trim(); }
function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString("es-ES") : "Sin fecha"; }
function phoneDigits(value?: string | null) { return text(value).replace(/\D/g, ""); }

export function ClientOperationsOverview({ initialClients = [], initialLeads = [], initialBookings = [], initialTasks = [], initialCases = [], filloutUrl = "" }: {
  initialClients?: unknown[];
  initialLeads?: unknown[];
  initialBookings?: unknown[];
  initialTasks?: unknown[];
  initialCases?: unknown[];
  filloutUrl?: string;
}) {
  const clients = initialClients as ClientRow[];
  const leads = initialLeads as LeadRow[];
  const bookings = initialBookings as BookingRow[];
  const cases = initialCases as CaseRow[];
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks as TaskRow[]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const clientMap = useMemo(() => new Map(clients.map((client) => [String(client.id || ""), client])), [clients]);
  const activeTasks = tasks.filter((task) => !["done", "cancelled"].includes(text(task.status)) && task.client_id);
  const clientsWithFollowUp = useMemo(() => {
    const ids = new Set<string>();
    for (const row of [...leads, ...bookings, ...activeTasks]) if (row.client_id) ids.add(String(row.client_id));
    return [...ids].map((id) => {
      const client = clientMap.get(id);
      const clientLeads = leads.filter((item) => String(item.client_id || "") === id);
      const clientBookings = bookings.filter((item) => String(item.client_id || "") === id);
      const clientTasks = activeTasks.filter((item) => String(item.client_id || "") === id);
      const clientCases = cases.filter((item) => String(item.client_id || "") === id);
      return { id, client, leads: clientLeads, bookings: clientBookings, tasks: clientTasks, cases: clientCases };
    }).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [activeTasks, bookings, cases, clientMap, leads]);

  async function updateTask(taskId: string, status: "done" | "in_progress" | "cancelled") {
    setBusyId(taskId); setMessage(null);
    const response = await fetch(`/api/routsify/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar la tarea."));
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
    setMessage(status === "done" ? "Tarea completada." : "Tarea actualizada.");
  }

  function reminderLinks(client: ClientRow | undefined, task: TaskRow) {
    const payload = task.payload || {};
    const url = text(payload.fillout_url) || filloutUrl;
    const body = text(payload.suggested_message) || (url ? `Hola, para poder preparar nuestra llamada necesitamos que completes este formulario: ${url}` : "Hola, para poder preparar nuestra llamada necesitamos que completes el formulario de viaje.");
    const subject = "Formulario previo a tu llamada con Routsify";
    return {
      email: client?.email ? `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null,
      whatsapp: phoneDigits(client?.phone) ? `https://wa.me/${phoneDigits(client?.phone)}?text=${encodeURIComponent(body)}` : null,
    };
  }

  return <section className="card client-operations-overview">
    <div className="panel-head"><div><h2>Seguimiento previo al expediente</h2><p>Clientes con formulario, llamada o tareas pendientes. El expediente solo se crea manualmente.</p></div><span className="badge">{activeTasks.length} tareas abiertas</span></div>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {clientsWithFollowUp.length === 0 ? <div className="empty-state"><h3>Sin seguimientos pendientes</h3><p>Las reservas y formularios nuevos aparecerán aquí.</p></div> : <div className="client-followup-grid">
      {clientsWithFollowUp.map((item) => {
        const latestLead = item.leads[0];
        const latestBooking = item.bookings[0];
        return <article className="client-followup-card" key={item.id}>
          <div className="section-heading"><div><h3>{item.client?.display_name || "Cliente sin nombre"}</h3><p>{item.client?.email || item.client?.phone || "Sin contacto"}</p></div><span className={`status-pill ${item.cases.length ? "status-success" : "status-warning"}`}>{item.cases.length ? `${item.cases.length} expediente(s)` : "Sin expediente"}</span></div>
          <dl className="client-followup-summary"><div><dt>Formulario</dt><dd>{latestLead?.status === "form_received" ? "Recibido" : latestLead ? text(latestLead.status) : "Pendiente"}</dd></div><div><dt>Llamada</dt><dd>{latestBooking ? `${text(latestBooking.status) || "Reservada"} · ${dateTime(latestBooking.starts_at)}` : "Sin reserva"}</dd></div><div><dt>Destino</dt><dd>{latestLead?.destination || "Sin indicar"}</dd></div></dl>
          <div className="client-task-list">{item.tasks.length ? item.tasks.map((task) => {
            const isReminder = text(task.payload?.action_type) === "fillout_reminder";
            const links = reminderLinks(item.client, task);
            return <div className="client-task-item" key={task.id}><div><strong>{task.title || "Tarea"}</strong><small>{dateTime(task.due_at)} · {task.priority || "normal"}</small></div><div className="client-task-actions">{isReminder && links.email ? <a className="btn secondary" href={links.email}>Email</a> : null}{isReminder && links.whatsapp ? <a className="btn secondary" href={links.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}<button className="btn" type="button" disabled={busyId === task.id} onClick={() => task.id && void updateTask(task.id, "done")}>{busyId === task.id ? "Guardando..." : "Completar"}</button></div></div>;
          }) : <p className="field-help">No hay tareas abiertas para este cliente.</p>}</div>
          <div className="form-actions"><a className="btn secondary" href={`/expedientes?clientId=${encodeURIComponent(item.id)}`}>Crear expediente manualmente</a>{item.cases[0]?.id ? <a className="btn" href={`/expedientes?caseId=${encodeURIComponent(String(item.cases[0].id))}`}>Abrir expediente</a> : null}</div>
        </article>;
      })}
    </div>}
  </section>;
}
