import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { NormalizedRemoteBooking } from "@/lib/routsify-booking-api-server";

export type BookingClient = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function loadBookingClient(organizationId: string, clientId: string): Promise<BookingClient> {
  const { data, error } = await getSupabaseAdminClient()
    .from("clients")
    .select("id,display_name,email,phone")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("client_not_found");
  return {
    id: String(data.id),
    displayName: text(data.display_name) || "Cliente",
    email: text(data.email) || null,
    phone: text(data.phone) || null,
  };
}

export async function loadManagedBooking(organizationId: string, bookingId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("bookings")
    .select("id,organization_id,client_id,lead_id,external_booking_id,event_type,starts_at,ends_at,status,source,event_timestamp,payload,created_at,updated_at")
    .eq("organization_id", organizationId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("booking_not_found");
  if (!data.external_booking_id) throw new Error("booking_external_id_missing");
  return data as Record<string, unknown>;
}

export async function persistRemoteBooking(input: {
  organizationId: string;
  clientId: string;
  actorId: string;
  remote: NormalizedRemoteBooking;
  eventType: "booking.created" | "booking.updated" | "booking.cancelled";
  requestedStartsAt?: string | null;
  requestedEndsAt?: string | null;
  requestedPayload?: Record<string, unknown>;
}) {
  if (!input.remote.externalBookingId) throw new Error("booking_external_id_missing");
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await db
    .from("bookings")
    .select("id,starts_at,ends_at,payload")
    .eq("organization_id", input.organizationId)
    .eq("external_booking_id", input.remote.externalBookingId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const payload = {
    ...(existing?.payload && typeof existing.payload === "object" ? existing.payload as Record<string, unknown> : {}),
    ...(input.requestedPayload || {}),
    remote: input.remote.raw,
    booking_url: input.remote.bookingUrl,
    meeting_url: input.remote.meetingUrl,
    managed_by_api: true,
    last_api_action: input.eventType,
    last_api_action_at: now,
  };
  const row = {
    organization_id: input.organizationId,
    client_id: input.clientId,
    external_booking_id: input.remote.externalBookingId,
    external_id: input.remote.externalBookingId,
    event_type: input.eventType,
    starts_at: input.requestedStartsAt || input.remote.startsAt || existing?.starts_at || null,
    ends_at: input.requestedEndsAt || input.remote.endsAt || existing?.ends_at || null,
    status: input.eventType === "booking.cancelled" ? "cancelled" : input.remote.status || "scheduled",
    source: "routsify_booking_api",
    event_timestamp: now,
    payload,
    updated_at: now,
  };

  const result = existing?.id
    ? await db.from("bookings").update(row).eq("organization_id", input.organizationId).eq("id", existing.id).select("*").single()
    : await db.from("bookings").insert(row).select("*").single();
  if (result.error) throw new Error(result.error.message);

  const taskKey = `booking_call:${input.remote.externalBookingId}`;
  if (input.eventType === "booking.cancelled") {
    await db.from("tasks").update({ status: "cancelled", updated_at: now }).eq("organization_id", input.organizationId).eq("idempotency_key", taskKey).in("status", ["pending", "in_progress"]);
  } else {
    const { data: task } = await db.from("tasks").select("id,status").eq("organization_id", input.organizationId).eq("idempotency_key", taskKey).maybeSingle();
    const taskPayload = { action_type: "booking_call", booking_id: result.data.id, external_booking_id: input.remote.externalBookingId, meeting_url: input.remote.meetingUrl };
    if (task?.id) {
      await db.from("tasks").update({ client_id: input.clientId, title: "Preparar y realizar llamada comercial", due_at: row.starts_at, payload: taskPayload, updated_at: now }).eq("organization_id", input.organizationId).eq("id", task.id);
    } else {
      await db.from("tasks").insert({ organization_id: input.organizationId, client_id: input.clientId, title: "Preparar y realizar llamada comercial", status: "pending", priority: "normal", due_at: row.starts_at, idempotency_key: taskKey, payload: taskPayload });
    }
  }

  const title = input.eventType === "booking.created" ? "Llamada reservada desde Routsify" : input.eventType === "booking.cancelled" ? "Llamada cancelada desde Routsify" : "Llamada modificada desde Routsify";
  await db.from("timeline_events").insert({
    organization_id: input.organizationId,
    client_id: input.clientId,
    event_type: input.eventType,
    title,
    payload: {
      booking_id: result.data.id,
      external_booking_id: input.remote.externalBookingId,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      booking_url: input.remote.bookingUrl,
      meeting_url: input.remote.meetingUrl,
    },
    created_by: input.actorId,
  });

  return result.data as Record<string, unknown>;
}

export async function recordBookingLinkAction(input: {
  organizationId: string;
  clientId: string;
  actorId: string;
  channel: "copy" | "email" | "whatsapp";
  url: string;
}) {
  const { error } = await getSupabaseAdminClient().from("timeline_events").insert({
    organization_id: input.organizationId,
    client_id: input.clientId,
    event_type: input.channel === "copy" ? "booking.link_generated" : "booking.link_sent",
    title: input.channel === "copy" ? "Enlace de reserva preparado" : `Enlace de reserva enviado por ${input.channel === "email" ? "email" : "WhatsApp"}`,
    payload: { channel: input.channel, booking_url: input.url },
    created_by: input.actorId,
  });
  if (error) throw new Error(error.message);
}
