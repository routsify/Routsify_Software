"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LeadReviewRow } from "@/lib/lead-review-server";

type ReviewAction = "mark_won" | "mark_lost" | "archive" | "reopen";

const statusLabels: Record<string, string> = {
  form_received: "Nueva",
  form_received_call_booked: "Llamada reservada",
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

export function LeadReviewTable({ initialItems, canManage }: { initialItems: LeadReviewRow[]; canManage: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id || "");
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

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
      setMessage(payload.warning ? "Solicitud reabierta, pero no se pudo crear la tarea de seguimiento." : action === "mark_won" ? "Compra registrada." : action === "mark_lost" ? "Solicitud cerrada sin compra." : action === "reopen" ? "Solicitud reabierta y asignada para revisión." : "Solicitud archivada.");
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
                  <td><span className={row.outcome === "won" ? "status-pill status-success" : row.outcome === "lost" ? "status-pill status-danger" : "status-pill"}>{statusLabels[row.status] || row.status}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>

      {selected ? <aside className="card lead-detail">
        <div className="lead-detail-heading">
          <div><span className="eyebrow">Solicitud seleccionada</span><h2>{client(selected).display_name}</h2><p>{selected.destination || "Destino pendiente"} · {date(selected.travel_start)}</p></div>
          <span className={selected.outcome === "won" ? "status-pill status-success" : selected.outcome === "lost" ? "status-pill status-danger" : "status-pill"}>{statusLabels[selected.status] || selected.status}</span>
        </div>

        <dl className="lead-detail-grid">
          <div><dt>Contacto</dt><dd>{client(selected).email || client(selected).phone || "Sin datos"}</dd></div>
          <div><dt>Viajeros</dt><dd>{selected.travelers || "—"}</dd></div>
          <div><dt>Presupuesto</dt><dd>{money(selected.budget_hint)}</dd></div>
          <div><dt>Resultado</dt><dd>{selected.outcome === "won" ? "Compró" : selected.outcome === "lost" ? "No compró" : selected.outcome === "open" ? "Abierta" : "Sin confirmar"}</dd></div>
        </dl>

        {selected.review_note ? <p className="lead-note">{selected.review_note}</p> : null}
        {message ? <p className="client-message" role="status">{message}</p> : null}

        <div className="lead-contact-actions">
          {client(selected).email ? <a className="btn secondary" href={`mailto:${client(selected).email}`}>Email</a> : null}
          {client(selected).phone ? <a className="btn secondary" href={`tel:${client(selected).phone}`}>Llamar</a> : null}
          {selected.client_id ? <Link className="btn secondary" href={`/clientes/${selected.client_id}`}>Ficha 360</Link> : null}
        </div>

        {canManage ? <div className="lead-review-actions">
          <h3>Resultado comercial</h3>
          <button className="btn" type="button" disabled={Boolean(busy) || selected.outcome === "won"} onClick={() => void review("mark_won")}>{busy === "mark_won" ? "Guardando…" : "Compró"}</button>
          <button className="btn secondary" type="button" disabled={Boolean(busy) || selected.outcome === "lost"} onClick={() => void review("mark_lost")}>{busy === "mark_lost" ? "Guardando…" : "No compró"}</button>
          {selected.review_status === "pending" ? <button className="link-button" type="button" disabled={Boolean(busy)} onClick={() => void review("archive")}>Archivar sin confirmar</button> : <button className="link-button" type="button" disabled={Boolean(busy)} onClick={() => void review("reopen")}>{busy === "reopen" ? "Reabriendo…" : "Reabrir seguimiento"}</button>}
        </div> : null}
      </aside> : null}
    </section>
  );
}
