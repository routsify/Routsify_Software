"use client";

import { useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Slot = { startsAt: string; endsAt: string | null; available: boolean; label: string };

function text(value: unknown) {
  return String(value ?? "").trim();
}

function dateTime(value: unknown) {
  const raw = text(value);
  if (!raw) return "Sin fecha";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function localInput(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function normalizedBookings(rows: Row[]) {
  const byExternal = new Map<string, Row>();
  const withoutExternal: Row[] = [];
  for (const row of rows) {
    const externalId = text(row.external_booking_id || row.external_id);
    if (!externalId) {
      withoutExternal.push(row);
      continue;
    }
    const previous = byExternal.get(externalId);
    const previousTime = previous ? new Date(text(previous.updated_at || previous.created_at)).getTime() : 0;
    const currentTime = new Date(text(row.updated_at || row.created_at)).getTime();
    if (!previous || currentTime >= previousTime) byExternal.set(externalId, row);
  }
  return [...byExternal.values(), ...withoutExternal].sort((a, b) => new Date(text(b.starts_at || b.created_at)).getTime() - new Date(text(a.starts_at || a.created_at)).getTime());
}

function payloadOf(row: Row) {
  return row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload as Row : {};
}

export function BookingApiPanel({ client, initialBookings }: { client: Row; initialBookings: Row[] }) {
  const clientId = text(client.id);
  const [bookings, setBookings] = useState<Row[]>(() => normalizedBookings(initialBookings));
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [notes, setNotes] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingLink, setBookingLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const activeBookings = useMemo(() => bookings.filter((item) => text(item.status).toLowerCase() !== "cancelled"), [bookings]);

  async function bookingLinkAction(channel: "copy" | "email" | "whatsapp") {
    setBusy(`link:${channel}`); setMessage(null);
    const response = await fetch("/api/routsify/clients/booking/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, channel }),
    });
    const result = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo preparar el enlace de reserva."));
      return;
    }
    const url = text(result.data?.url);
    setBookingLink(url);
    if (channel === "copy" && url) {
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Enlace personalizado copiado.");
      } catch {
        setMessage("Enlace preparado. Cópialo desde el campo mostrado.");
      }
    } else {
      setMessage(channel === "email" ? "Enlace enviado por email." : "Enlace enviado por WhatsApp.");
    }
  }

  async function checkAvailability() {
    setBusy("availability"); setMessage(null); setSlots([]);
    const reference = startsAt ? new Date(startsAt) : new Date();
    if (Number.isNaN(reference.getTime())) {
      setBusy(null); setMessage("Selecciona una fecha válida."); return;
    }
    const from = new Date(Math.max(Date.now(), reference.getTime() - 12 * 60 * 60 * 1000));
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), duration: String(durationMinutes), timezone: "Europe/Madrid" });
    const response = await fetch(`/api/routsify/clients/booking/availability?${params.toString()}`);
    const result = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo consultar la disponibilidad."));
      return;
    }
    const nextSlots = Array.isArray(result.data?.slots) ? result.data.slots as Slot[] : [];
    setSlots(nextSlots.filter((slot) => slot.available).slice(0, 40));
    setMessage(nextSlots.length ? "Disponibilidad actualizada." : "La API no devolvió huecos en los próximos 14 días.");
  }

  async function saveBooking() {
    if (!startsAt) return setMessage("Selecciona fecha y hora para la llamada.");
    if (!editingId && !privacyAccepted) return setMessage("Confirma que el cliente ha aceptado la política de privacidad.");
    setBusy("save"); setMessage(null);
    const url = editingId ? `/api/routsify/clients/booking/reservations/${encodeURIComponent(editingId)}` : "/api/routsify/clients/booking/reservations";
    const response = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, startsAt: new Date(startsAt).toISOString(), durationMinutes, timezone: "Europe/Madrid", notes, privacyAccepted: editingId ? undefined : privacyAccepted }),
    });
    const result = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo guardar la reserva."));
      return;
    }
    const saved = result.data?.booking as Row;
    setBookings((current) => normalizedBookings([saved, ...current.filter((item) => text(item.id) !== text(saved.id))]));
    setMessage(editingId ? "Llamada reprogramada en Routsify Booking." : "Llamada reservada en Routsify Booking.");
    setEditingId(null); setStartsAt(""); setNotes(""); setPrivacyAccepted(false); setSlots([]);
  }

  function startEdit(booking: Row) {
    setEditingId(text(booking.id));
    setStartsAt(localInput(booking.starts_at));
    const payload = payloadOf(booking);
    const storedDuration = Number(payload.duration_minutes || 30);
    setDurationMinutes(Number.isFinite(storedDuration) ? storedDuration : 30);
    setNotes(text(payload.notes));
    setMessage("Modifica la fecha o las notas y guarda los cambios.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cancelBooking(booking: Row) {
    const bookingId = text(booking.id);
    if (!bookingId || !window.confirm("¿Cancelar esta llamada también en Routsify Booking?")) return;
    setBusy(`cancel:${bookingId}`); setMessage(null);
    const response = await fetch(`/api/routsify/clients/booking/reservations/${encodeURIComponent(bookingId)}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo cancelar la reserva."));
      return;
    }
    const saved = result.data?.booking as Row;
    setBookings((current) => normalizedBookings([saved, ...current.filter((item) => text(item.id) !== bookingId)]));
    if (editingId === bookingId) { setEditingId(null); setStartsAt(""); setNotes(""); }
    setMessage("Llamada cancelada en Routsify Booking.");
  }

  return <section className="card client360-full">
    <div className="panel-head"><div><h2>Routsify Booking</h2><p>Envía el enlace personalizado o reserva, reprograma y cancela llamadas sin salir de la ficha del cliente.</p></div><span className="badge">{activeBookings.length} activas</span></div>
    {message ? <p className={message.toLowerCase().includes("no se pudo") || message.toLowerCase().includes("required") ? "form-warning" : "client-message"} role="status">{message}</p> : null}

    <div className="client360-grid">
      <div className="card">
        <div className="section-heading"><div><h3>Enviar enlace de reserva</h3><p>El enlace incluye los datos disponibles del cliente para simplificar la reserva.</p></div></div>
        <div className="form-actions">
          <button className="btn secondary" type="button" disabled={busy !== null} onClick={() => void bookingLinkAction("copy")}>{busy === "link:copy" ? "Preparando..." : "Copiar enlace"}</button>
          <button className="btn secondary" type="button" disabled={busy !== null || !text(client.email)} onClick={() => void bookingLinkAction("email")}>{busy === "link:email" ? "Enviando..." : "Enviar por email"}</button>
          <button className="btn" type="button" disabled={busy !== null || !text(client.phone)} onClick={() => void bookingLinkAction("whatsapp")}>{busy === "link:whatsapp" ? "Enviando..." : "Enviar por WhatsApp"}</button>
        </div>
        {bookingLink ? <label>Enlace preparado<input className="input" readOnly value={bookingLink} onFocus={(event) => event.currentTarget.select()} /></label> : null}
      </div>

      <div className="card">
        <div className="section-heading"><div><h3>{editingId ? "Reprogramar llamada" : "Reservar llamada"}</h3><p>La acción se guarda tanto en call.routsify.com como en el historial del cliente.</p></div></div>
        <div className="form">
          <label>Fecha y hora<input className="input" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label>Duración<select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>60 minutos</option><option value={90}>90 minutos</option></select></label>
          <label>Notas internas<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Objetivo de la llamada, idioma, contexto..." /></label>
          {!editingId ? <label className="checkbox-row"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />El cliente ha aceptado la política de privacidad para gestionar la reserva.</label> : null}
          <div className="form-actions">
            <button className="btn secondary" type="button" disabled={busy !== null} onClick={() => void checkAvailability()}>{busy === "availability" ? "Consultando..." : "Consultar disponibilidad"}</button>
            <button className="btn" type="button" disabled={busy !== null || !startsAt || (!editingId && !privacyAccepted)} onClick={() => void saveBooking()}>{busy === "save" ? "Guardando..." : editingId ? "Guardar reprogramación" : "Reservar llamada"}</button>
            {editingId ? <button className="link-button" type="button" disabled={busy !== null} onClick={() => { setEditingId(null); setStartsAt(""); setNotes(""); }}>Cancelar edición</button> : null}
          </div>
        </div>
      </div>
    </div>

    {slots.length ? <div className="card"><div className="section-heading"><div><h3>Huecos disponibles</h3><p>Selecciona uno para completar automáticamente la fecha y hora.</p></div><span className="badge">{slots.length}</span></div><div className="form-actions">{slots.map((slot) => <button className="btn secondary" type="button" key={`${slot.startsAt}-${slot.endsAt || ""}`} onClick={() => setStartsAt(localInput(slot.startsAt))}>{dateTime(slot.startsAt)}</button>)}</div></div> : null}

    <div className="section-heading"><div><h3>Llamadas registradas</h3><p>Las reservas recibidas por webhook y las gestionadas por API aparecen en una única lista.</p></div><span className="badge">{bookings.length}</span></div>
    {bookings.length === 0 ? <div className="empty-state"><h3>Sin llamadas</h3><p>Envía el enlace al cliente o crea la primera reserva desde esta pantalla.</p></div> : <div className="client360-list">{bookings.map((booking) => {
      const bookingId = text(booking.id);
      const payload = payloadOf(booking);
      const status = text(booking.status) || "scheduled";
      const meetingUrl = text(payload.meeting_url || (payload.remote as Row | undefined)?.meeting_url);
      const manageUrl = text(payload.booking_url || (payload.remote as Row | undefined)?.booking_url);
      const cancelled = status.toLowerCase() === "cancelled";
      return <article className="client360-list-item" key={bookingId || `${text(booking.external_booking_id)}-${text(booking.event_timestamp)}`}>
        <div><strong>{dateTime(booking.starts_at)}</strong><small>{status} · {text(booking.source) || "booking"} · ID {text(booking.external_booking_id) || "pendiente"}</small></div>
        <div className="client360-row-actions">
          {meetingUrl ? <a className="btn secondary" href={meetingUrl} target="_blank" rel="noreferrer">Abrir reunión</a> : null}
          {manageUrl ? <a className="btn secondary" href={manageUrl} target="_blank" rel="noreferrer">Abrir en Booking</a> : null}
          {!cancelled && text(booking.external_booking_id) ? <button className="btn secondary" type="button" disabled={busy !== null} onClick={() => startEdit(booking)}>Reprogramar</button> : null}
          {!cancelled && text(booking.external_booking_id) ? <button className="link-button danger" type="button" disabled={busy !== null} onClick={() => void cancelBooking(booking)}>{busy === `cancel:${bookingId}` ? "Cancelando..." : "Cancelar"}</button> : null}
        </div>
      </article>;
    })}</div>}
  </section>;
}
