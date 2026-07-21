"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeadReviewRow } from "@/lib/lead-review-server";

type ReviewAction = "mark_won" | "mark_lost" | "archive" | "reopen" | "mark_form_sent" | "mark_booking_sent" | "convert";

const statusLabels: Record<string, string> = {
  form_received: "Nueva",
  form_received_call_pending: "Solo formulario",
  form_received_call_booked: "Llamada reservada",
  call_booked_form_pending: "Solo llamada",
  qualified: "En seguimiento",
  converted: "Convertida",
  won: "Compró",
  lost: "No compró",
  archived: "Archivada",
};

function date(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function money(value: number | null) {
  if (!value) return "Sin presupuesto";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function client(row: LeadReviewRow) {
  return row.clients || {
    id: row.client_id || "",
    display_name: row.client_name || "Cliente sin nombre",
    email: row.email,
    phone: row.phone,
  };
}

function intakeState(row: LeadReviewRow) {
  if (row.form_received_at && row.call_booked_at) return "complete" as const;
  if (row.call_booked_at) return "call_only" as const;
  if (row.form_received_at) return "form_only" as const;
  return "pending" as const;
}

function intakeLabel(row: LeadReviewRow) {
  const state = intakeState(row);
  if (state === "complete") return "Formulario + llamada";
  if (state === "call_only") return "Solo llamada";
  if (state === "form_only") return "Solo formulario";
  return statusLabels[row.status] || row.status;
}

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Pendiente";
}

export function LeadReviewTable({ initialItems, canManage }: { initialItems: LeadReviewRow[]; canManage: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id || "");
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const syncFillout = useCallback(async (manual = false) => {
    if (syncingRef.current || document.visibilityState === "hidden") return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const response = await fetch("/api/routsify/leads/sync-fillout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full: false, maxPages: 2 }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) throw new Error(String(payload?.error || "No se pudo sincronizar Fillout."));
      const found = Number(payload.data.fetched || 0);
      const queued = Number(payload.data.queued || 0);
      if (found > 0 || queued > 0) {
        setMessage(`Fillout actualizado: ${found} respuesta(s) revisadas.`);
        router.refresh();
      } else if (manual) {
        setMessage("Fillout está al día; no hay respuestas nuevas.");
      }
    } catch (error) {
      if (manual) setMessage(error instanceof Error ? error.message : "No se pudo sincronizar Fillout.");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [router]);

  useEffect(() => {
    void syncFillout(false);
    const interval = window.setInterval(() => void syncFillout(false), 30_000);
    return () => window.clearInterval(interval);
  }, [syncFillout]);

  async function review(action: ReviewAction) {
    if (!selected || busy) return;
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/routsify/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: selected.id, action }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.lead) throw new Error(payload?.error || "No se pudo actualizar la solicitud.");
      setItems((current) => current.map((item) => item.id === selected.id ? { ...item, ...payload.lead } : item));
      setMessage(payload.warning ? "Solicitud actualizada, pero no se pudo crear la tarea de seguimiento." : action === "mark_won" ? "Compra registrada." : action === "mark_lost" ? "Solicitud cerrada sin compra." : action === "reopen" ? "Solicitud reabierta y asignada para revisión." : action === "mark_form_sent" ? "Envío del formulario registrado." : action === "mark_booking_sent" ? "Envío del enlace de reserva registrado." : action === "convert" ? "Oportunidad convertida y lista para trabajar." : "Solicitud archivada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la solicitud.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <section className="card empty-state"><h2>No hay solicitudes en esta vista</h2><p>Prueba otro estado o elimina los filtros aplicados.</p></section>;
  }

  return (
    <section className="lead-layout">
      <div className="card lead-table-card">
        <div className="lead-table-head"><div><h2>Bandeja operativa</h2><p>La sincronización de respaldo revisa Fillout cada 30 segundos mientras esta pantalla está abierta.</p></div><button className="btn secondary" type="button" disabled={syncing} onClick={() => void syncFillout(true)}>{syncing ? "Actualizando…" : "Actualizar ahora"}</button></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Cliente</th><th>Viaje</th><th>Solicitud</th><th>Estado</th></tr></thead>
            <tbody>{items.map((row) => {
              const person = client(row);
              return (
                <tr key={row.id} className={row.id === selected?.id ? "selected-row" : undefined}>
                  <td><button className="table-link" type="button" onClick={() => { setSelectedId(row.id); setMessage(null); }}><strong>{person.display_name}</strong><small>{person.email || person.phone || "Sin contacto"}</small></button></td>
                  <td>{row.destination || "Destino pendiente"}<small>{date(row.travel_start)}</small></td>
                  <td>{row.travelers ? `${row.travelers} viajero(s)` : "Viajeros sin indicar"}<small>{money(row.budget_hint)}</small></td>
                  <td><span className={row.outcome === "won" ? "status-pill status-success" : row.outcome === "lost" ? "status-pill status-danger" : intakeState(row) === "complete" ? "status-pill status-success" : intakeState(row) === "call_only" || intakeState(row) === "form_only" ? "status-pill status-warning" : "status-pill"}>{intakeLabel(row)}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>

      {selected ? <aside className="card lead-detail">
        <div className="lead-detail-heading">
          <div><span className="eyebrow">Solicitud seleccionada</span><h2>{client(selected).display_name}</h2><p>{selected.destination || "Destino pendiente"} · {date(selected.travel_start)}</p></div>
          <span className={selected.outcome === "won" ? "status-pill status-success" : selected.outcome === "lost" ? "status-pill status-danger" : intakeState(selected) === "complete" ? "status-pill status-success" : "status-pill status-warning"}>{intakeLabel(selected)}</span>
        </div>

        <dl className="lead-detail-grid">
          <div><dt>Contacto</dt><dd>{client(selected).email || client(selected).phone || "Sin datos"}</dd></div>
          <div><dt>Viajeros</dt><dd>{selected.travelers || "—"}</dd></div>
          <div><dt>Presupuesto</dt><dd>{money(selected.budget_hint)}</dd></div>
          <div><dt>Resultado</dt><dd>{selected.outcome === "won" ? "Compró" : selected.outcome === "lost" ? "No compró" : selected.outcome === "open" ? "Abierta" : "Sin confirmar"}</dd></div>
        </dl>

        <div className="lead-signal-grid" aria-label="Señales de entrada">
          <div className={selected.form_received_at ? "complete" : "pending"}><span>Formulario</span><strong>{selected.form_received_at ? "Recibido" : "Pendiente"}</strong><small>{dateTime(selected.form_received_at)}</small>{selected.form_reminder_sent_at ? <em>Enlace enviado {dateTime(selected.form_reminder_sent_at)}</em> : null}</div>
          <div className={selected.call_booked_at ? "complete" : "pending"}><span>Llamada</span><strong>{selected.call_booked_at ? "Reservada" : "Pendiente"}</strong><small>{dateTime(selected.call_booked_at)}</small>{selected.booking_invite_sent_at ? <em>Enlace enviado {dateTime(selected.booking_invite_sent_at)}</em> : null}</div>
        </div>

        {selected.review_note ? <p className="lead-note">{selected.review_note}</p> : null}
        {message ? <p className="client-message" role="status">{message}</p> : null}

        <div className="lead-contact-actions">
          {client(selected).email ? <a className="btn secondary" href={`mailto:${client(selected).email}`}>Email</a> : null}
          {client(selected).phone ? <a className="btn secondary" href={`tel:${client(selected).phone}`}>Llamar</a> : null}
          {selected.client_id ? <Link className="btn secondary" href={`/clientes/${selected.client_id}`}>Ficha 360</Link> : null}
        </div>

        {canManage ? <div className="lead-review-actions">
          <h3>Siguiente paso</h3>
          {intakeState(selected) === "call_only" ? <button className="btn" type="button" disabled={Boolean(busy) || Boolean(selected.form_reminder_sent_at)} onClick={() => void review("mark_form_sent")}>{busy === "mark_form_sent" ? "Guardando…" : selected.form_reminder_sent_at ? "Formulario ya enviado" : "Marcar formulario enviado"}</button> : null}
          {intakeState(selected) === "form_only" ? <button className="btn" type="button" disabled={Boolean(busy) || Boolean(selected.booking_invite_sent_at)} onClick={() => void review("mark_booking_sent")}>{busy === "mark_booking_sent" ? "Guardando…" : selected.booking_invite_sent_at ? "Reserva ya enviada" : "Marcar enlace de reserva enviado"}</button> : null}
          {intakeState(selected) === "complete" && selected.status !== "converted" ? <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => void review("convert")}>{busy === "convert" ? "Convirtiendo…" : "Convertir oportunidad"}</button> : null}
          <h3>Resultado comercial</h3>
          <button className="btn" type="button" disabled={Boolean(busy) || selected.outcome === "won"} onClick={() => void review("mark_won")}>{busy === "mark_won" ? "Guardando…" : "Compró"}</button>
          <button className="btn secondary" type="button" disabled={Boolean(busy) || selected.outcome === "lost"} onClick={() => void review("mark_lost")}>{busy === "mark_lost" ? "Guardando…" : "No compró"}</button>
          {selected.review_status === "pending" ? <button className="link-button" type="button" disabled={Boolean(busy)} onClick={() => void review("archive")}>Archivar sin confirmar</button> : <button className="link-button" type="button" disabled={Boolean(busy)} onClick={() => void review("reopen")}>{busy === "reopen" ? "Reabriendo…" : "Reabrir seguimiento"}</button>}
        </div> : null}
      </aside> : null}
    </section>
  );
}
