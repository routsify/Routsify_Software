"use client";

import { useMemo, useState } from "react";
import type { InboxCategory, OperationalInboxData, OperationalInboxItem } from "@/lib/operations-inbox-server";

type Filter = "all" | InboxCategory;

const categoryLabels: Record<InboxCategory, string> = {
  urgent: "Urgente",
  attention: "Necesita atención",
  commercial: "Comercial",
  operations: "Operativa",
};

const categoryIcons: Record<InboxCategory, string> = {
  urgent: "!",
  attention: "A",
  commercial: "C",
  operations: "O",
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function severityClass(value: OperationalInboxItem["severity"]) {
  if (value === "critical") return "inbox-item-critical";
  if (value === "high") return "inbox-item-high";
  if (value === "medium") return "inbox-item-medium";
  return "inbox-item-low";
}

export function TodayInbox({ initialData }: { initialData: OperationalInboxData }) {
  const [items, setItems] = useState(initialData.items);
  const [filter, setFilter] = useState<Filter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const counts = useMemo(() => ({
    urgent: items.filter((item) => item.category === "urgent").length,
    attention: items.filter((item) => item.category === "attention").length,
    commercial: items.filter((item) => item.category === "commercial").length,
    operations: items.filter((item) => item.category === "operations").length,
  }), [items]);
  const visible = filter === "all" ? items : items.filter((item) => item.category === filter);
  const nextBestAction = items[0] || null;

  async function changeTaskStatus(taskId: string, status: "in_progress" | "done") {
    setSavingId(taskId);
    setMessage(null);
    const response = await fetch(`/api/routsify/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo actualizar la tarea."));
      return;
    }
    if (status === "done") {
      setItems((current) => current.filter((item) => item.taskId !== taskId));
      setMessage("Tarea completada. La prioridad del día se ha actualizado.");
    } else {
      setItems((current) => current.map((item) => item.taskId === taskId ? { ...item, taskStatus: "in_progress", reason: "Tarea en curso" } : item));
      setMessage("Tarea marcada como en curso.");
    }
  }

  function filterButton(value: Filter, label: string, count: number) {
    return <button className={`inbox-filter ${filter === value ? "active" : ""}`} type="button" onClick={() => setFilter(value)}>
      <span>{label}</span><strong>{count}</strong>
    </button>;
  }

  return <div className="today-inbox">
    <section className="next-best-action card">
      <div className="next-best-copy">
        <span className="eyebrow">Próxima mejor acción</span>
        {nextBestAction ? <>
          <h1>{nextBestAction.title}</h1>
          <p>{nextBestAction.detail}</p>
          <div className="next-best-reason"><strong>Por qué ahora:</strong> {nextBestAction.reason}</div>
        </> : <>
          <h1>No hay acciones críticas pendientes</h1>
          <p>La bandeja operativa está al día.</p>
        </>}
      </div>
      {nextBestAction ? <div className="next-best-actions">
        <a className="btn" href={nextBestAction.href}>{nextBestAction.actionLabel}</a>
        {nextBestAction.taskId ? <button className="btn secondary" type="button" disabled={savingId === nextBestAction.taskId} onClick={() => void changeTaskStatus(nextBestAction.taskId as string, "done")}>{savingId === nextBestAction.taskId ? "Guardando..." : "Marcar hecha"}</button> : null}
      </div> : null}
    </section>

    <section className="inbox-summary">
      {filterButton("urgent", "Urgente", counts.urgent)}
      {filterButton("attention", "Necesita atención", counts.attention)}
      {filterButton("commercial", "Comercial", counts.commercial)}
      {filterButton("operations", "Operativa", counts.operations)}
      {filterButton("all", "Todo", items.length)}
    </section>

    <section className="card inbox-list-card">
      <div className="panel-head">
        <div><h2>{filter === "all" ? "Bandeja operativa priorizada" : categoryLabels[filter]}</h2><p>Ordenada por urgencia, impacto y proximidad temporal. Las tareas completadas desaparecen al instante.</p></div>
        <span className="badge">Actualizado {new Date(initialData.generatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      {message ? <p className="client-message" role="status">{message}</p> : null}
      {visible.length === 0 ? <div className="empty-state"><h2>No hay elementos en esta categoría</h2><p>No se ha detectado ninguna acción pendiente con estos criterios.</p></div> : <div className="inbox-list">
        {visible.map((current) => <article className={`inbox-item ${severityClass(current.severity)}`} key={current.id}>
          <div className={`inbox-category inbox-category-${current.category}`}><span>{categoryIcons[current.category]}</span>{categoryLabels[current.category]}</div>
          <div className="inbox-item-main">
            <div className="inbox-item-title"><h3>{current.title}</h3>{current.caseCode ? <span className="badge">{current.caseCode}</span> : null}</div>
            <p>{current.detail}</p>
            <div className="inbox-item-reason"><strong>{current.reason}</strong>{current.dueAt && formatDate(current.dueAt) ? <span> · {formatDate(current.dueAt)}</span> : null}</div>
          </div>
          <div className="inbox-item-actions">
            <a className="btn secondary" href={current.href}>{current.actionLabel}</a>
            {current.taskId ? <>
              {current.taskStatus !== "in_progress" ? <button className="link-button" type="button" disabled={savingId === current.taskId} onClick={() => void changeTaskStatus(current.taskId as string, "in_progress")}>Empezar</button> : <span className="status-pill status-progress">En curso</span>}
              <button className="link-button" type="button" disabled={savingId === current.taskId} onClick={() => void changeTaskStatus(current.taskId as string, "done")}>{savingId === current.taskId ? "Guardando..." : "Completar"}</button>
            </> : null}
          </div>
        </article>)}
      </div>}
    </section>
  </div>;
}
