import { createHash } from "node:crypto";
import { handleHoldedOutbox, syncHoldedPurchaseCandidates, type WorkerOutcome, type WorkerRow } from "@/lib/holded-outbox-handlers";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export { syncHoldedPurchaseCandidates };
export type OutboxWorkerResult = { ok: true; mode: "supabase"; processed: number; failed: number; manualReview: number; runId?: string; details: unknown[] } | { ok: false; mode: "supabase"; error: string };

const text = (value: unknown) => String(value || "").trim();
const emailOf = (payload: Record<string, unknown>) => text(payload.email || payload.email_address || payload.customer_email || payload.invitee_email).toLowerCase();
const phoneOf = (payload: Record<string, unknown>) => text(payload.phone || payload.telephone || payload.customer_phone || payload.invitee_phone);
const normalizedPhone = (value: string) => value.replace(/\D/g, "");
const numeric = (value: unknown) => { const parsed = Number(String(value ?? "").replace(/[^0-9.,-]/g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : null; };
const dateOnly = (value: unknown) => { const raw = text(value); if (!raw) return null; const date = new Date(raw); return Number.isNaN(date.getTime()) ? (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null) : date.toISOString().slice(0, 10); };
const firstText = (payload: Record<string, unknown>, keys: string[]) => keys.map((key) => text(payload[key])).find(Boolean) || "";

function redact(payload: Record<string, unknown>) {
  const safe = { ...payload };
  for (const key of ["passport", "document_number", "card_number", "token", "access_token", "authorization", "signature"]) delete safe[key];
  return safe;
}

async function organizationSetting(organizationId: string, key: string) {
  const { data } = await getSupabaseAdminClient().from("routsify_settings").select("value").eq("organization_id", organizationId).eq("key", key).maybeSingle();
  if (typeof data?.value === "string") return data.value.trim();
  if (data?.value && typeof data.value === "object" && "value" in data.value) return text((data.value as { value?: unknown }).value);
  return "";
}

async function createClientTimelineEvent(input: { organizationId: string; clientId: string | null; eventType: string; title: string; payload?: Record<string, unknown> }) {
  if (!input.clientId) return;
  const { error } = await getSupabaseAdminClient().from("timeline_events").insert({
    organization_id: input.organizationId,
    client_id: input.clientId,
    event_type: input.eventType,
    title: input.title,
    payload: input.payload || {},
  });
  if (error) throw new Error(error.message);
}

async function findOrCreateClient(organizationId: string, payload: Record<string, unknown>, source: string) {
  const db = getSupabaseAdminClient();
  const email = emailOf(payload);
  const phone = phoneOf(payload);
  const phoneNormalized = normalizedPhone(phone);
  const displayName = firstText(payload, ["name", "full_name", "customer_name", "invitee_name"]) || email || phone || "Cliente pendiente";

  if (email) {
    const { data } = await db.from("clients").select("id").eq("organization_id", organizationId).eq("email_normalized", email).maybeSingle();
    if (data?.id) return { clientId: String(data.id), possibleDuplicateClientId: null, created: false };
  }

  let phoneMatch: string | null = null;
  if (phoneNormalized) {
    const { data } = await db.from("clients").select("id").eq("organization_id", organizationId).eq("phone_normalized", phoneNormalized).limit(1).maybeSingle();
    phoneMatch = data?.id ? String(data.id) : null;
  }

  if (!email && phoneMatch) return { clientId: phoneMatch, possibleDuplicateClientId: null, created: false };
  if (!email && !phoneNormalized) return { clientId: null, possibleDuplicateClientId: null, created: false };

  const insertPayload = {
    organization_id: organizationId,
    display_name: displayName,
    client_type: "person",
    email: email || null,
    email_normalized: email || null,
    phone: phone || null,
    phone_normalized: phoneNormalized || null,
    source,
  };
  const query = email
    ? db.from("clients").upsert(insertPayload, { onConflict: "organization_id,email_normalized" })
    : db.from("clients").insert(insertPayload);
  const { data, error } = await query.select("id").single();
  if (error) throw new Error(error.message);
  return { clientId: String(data.id), possibleDuplicateClientId: phoneMatch, created: true };
}

async function createFollowUpTask(input: { organizationId: string; clientId: string | null; title: string; dueAt?: string | null; idempotencyKey: string; payload: Record<string, unknown>; priority?: string }) {
  const { error } = await getSupabaseAdminClient().from("tasks").upsert({
    organization_id: input.organizationId,
    client_id: input.clientId,
    title: input.title,
    status: "pending",
    priority: input.priority || "high",
    due_at: input.dueAt || new Date().toISOString(),
    idempotency_key: input.idempotencyKey,
    payload: input.payload,
  }, { onConflict: "organization_id,idempotency_key" });
  if (error) throw new Error(error.message);
}

async function completePendingFormTasks(organizationId: string, clientId: string | null, leadId: string) {
  if (!clientId) return;
  await getSupabaseAdminClient()
    .from("tasks")
    .update({ status: "done", updated_at: new Date().toISOString(), payload: { action_type: "fillout_reminder", completed_by_event: "form_received", lead_id: leadId } })
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .in("status", ["pending", "in_progress"])
    .contains("payload", { action_type: "fillout_reminder" });
}

async function form(row: WorkerRow): Promise<WorkerOutcome> {
  const payload = row.payload || {};
  const db = getSupabaseAdminClient();
  const source = text(payload.source) || "fillout";
  const email = emailOf(payload);
  const phone = phoneOf(payload);
  const phoneNormalized = normalizedPhone(phone);
  const client = await findOrCreateClient(row.organization_id, payload, source);
  const sourceId = text(payload.submission_id || payload.submissionId || payload.response_id || row.id);
  const safePayload = redact(payload);

  const leadPayload = {
    organization_id: row.organization_id,
    client_id: client.clientId,
    possible_duplicate_client_id: client.possibleDuplicateClientId,
    source,
    client_name: firstText(payload, ["name", "full_name", "customer_name"]) || "Lead sin nombre",
    email: email || null,
    email_normalized: email || null,
    phone: phone || null,
    phone_normalized: phoneNormalized || null,
    campaign: firstText(payload, ["campaign", "utm_campaign"]) || null,
    destination: firstText(payload, ["destination", "destino", "trip_destination"]) || null,
    travel_start: dateOnly(payload.travel_start || payload.start_date || payload.departure_date),
    travel_end: dateOnly(payload.travel_end || payload.end_date || payload.return_date),
    travelers: Math.max(1, Number(payload.travelers || payload.travellers || payload.people || 1)),
    budget_hint: numeric(payload.budget_hint || payload.budget || payload.presupuesto),
    status: "form_received",
    source_submission_id: sourceId,
    payload_hash: createHash("sha256").update(JSON.stringify(safePayload)).digest("hex"),
    payload_redacted: safePayload,
    updated_at: new Date().toISOString(),
  };
  const { data: lead, error } = await db.from("leads").upsert(leadPayload, { onConflict: "organization_id,source,source_submission_id" }).select("id").single();
  if (error) throw new Error(error.message);

  await completePendingFormTasks(row.organization_id, client.clientId, String(lead.id));
  await createFollowUpTask({
    organizationId: row.organization_id,
    clientId: client.clientId,
    title: `Revisar formulario recibido${leadPayload.destination ? ` · ${leadPayload.destination}` : ""}`,
    idempotencyKey: `lead_followup:${lead.id}`,
    payload: { action_type: "review_fillout", lead_id: lead.id, source, possible_duplicate_client_id: client.possibleDuplicateClientId },
  });
  await createClientTimelineEvent({
    organizationId: row.organization_id,
    clientId: client.clientId,
    eventType: "fillout.received",
    title: "Formulario de viaje recibido",
    payload: { lead_id: lead.id, source_submission_id: sourceId, destination: leadPayload.destination },
  });

  return { status: "done", message: "Formulario registrado; el cliente continúa sin expediente hasta la creación manual.", metadata: { client_id: client.clientId, lead_id: lead.id, possible_duplicate_client_id: client.possibleDuplicateClientId } };
}

async function booking(row: WorkerRow): Promise<WorkerOutcome> {
  const payload = row.payload || {};
  const db = getSupabaseAdminClient();
  const externalId = text(payload.external_booking_id || payload.booking_id || payload.id || payload.event_id);
  if (!externalId) throw new Error("external_booking_id_required");

  const source = text(payload.source) || "routsify_booking";
  const eventType = text(payload.event_type || payload.type) || "booking.created";
  const timestamp = text(payload.event_timestamp || payload.updated_at || payload.created_at) || new Date().toISOString();
  const client = await findOrCreateClient(row.organization_id, payload, source);
  const email = emailOf(payload);
  const phone = phoneOf(payload);

  let leadId: string | null = null;
  if (client.clientId) {
    const { data: recentLead } = await db.from("leads").select("id").eq("organization_id", row.organization_id).eq("client_id", client.clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    leadId = recentLead?.id ? String(recentLead.id) : null;
  }
  if (!leadId && (email || phone)) {
    const safePayload = redact(payload);
    const { data: lead, error: leadError } = await db.from("leads").upsert({
      organization_id: row.organization_id,
      client_id: client.clientId,
      possible_duplicate_client_id: client.possibleDuplicateClientId,
      source,
      client_name: firstText(payload, ["name", "full_name", "customer_name", "invitee_name"]) || "Reserva sin nombre",
      email: email || null,
      email_normalized: email || null,
      phone: phone || null,
      phone_normalized: normalizedPhone(phone) || null,
      destination: firstText(payload, ["destination", "destino"]) || null,
      travelers: Math.max(1, Number(payload.travelers || 1)),
      status: "call_booked_form_pending",
      source_submission_id: `booking:${externalId}`,
      payload_hash: createHash("sha256").update(JSON.stringify(safePayload)).digest("hex"),
      payload_redacted: safePayload,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,source,source_submission_id" }).select("id").single();
    if (leadError) throw new Error(leadError.message);
    leadId = String(lead.id);
  }

  const startsAt = text(payload.starts_at || payload.start_time || payload.start) || null;
  const endsAt = text(payload.ends_at || payload.end_time || payload.end) || null;
  const status = text(payload.status) || (eventType.includes("cancel") ? "cancelled" : "received");
  const { data: bookingRow, error } = await db.from("bookings").upsert({
    organization_id: row.organization_id,
    client_id: client.clientId,
    lead_id: leadId,
    possible_duplicate_client_id: client.possibleDuplicateClientId,
    external_id: externalId,
    external_booking_id: externalId,
    source,
    event_type: eventType,
    event_timestamp: timestamp,
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    payload: redact(payload),
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,source,external_booking_id,event_type,event_timestamp" }).select("id").single();
  if (error) throw new Error(error.message);

  if (leadId) await db.from("leads").update({ status: status === "cancelled" ? "booking_cancelled" : "call_booked_form_pending", updated_at: new Date().toISOString() }).eq("id", leadId).eq("organization_id", row.organization_id);

  if (status === "cancelled") {
    await createFollowUpTask({
      organizationId: row.organization_id,
      clientId: client.clientId,
      title: "Contactar tras cancelación de llamada",
      dueAt: new Date().toISOString(),
      idempotencyKey: `booking_followup:${externalId}:${eventType}:${timestamp}`,
      payload: { action_type: "booking_cancelled_followup", booking_id: bookingRow.id, lead_id: leadId, event_type: eventType, status },
      priority: "high",
    });
  } else {
    const filloutUrl = await organizationSetting(row.organization_id, "integrations.fillout.public_url");
    const reminderMessage = filloutUrl
      ? `Hola, para poder preparar nuestra llamada necesitamos que completes este formulario: ${filloutUrl}`
      : "Hola, para poder preparar nuestra llamada necesitamos que completes el formulario de viaje. Añade la URL de Fillout en Ajustes antes de enviarlo.";
    await Promise.all([
      createFollowUpTask({
        organizationId: row.organization_id,
        clientId: client.clientId,
        title: "Enviar recordatorio para completar el formulario",
        dueAt: new Date().toISOString(),
        idempotencyKey: `fillout_reminder:${externalId}`,
        payload: { action_type: "fillout_reminder", booking_id: bookingRow.id, lead_id: leadId, recipient_email: email || null, recipient_phone: phone || null, fillout_url: filloutUrl || null, suggested_message: reminderMessage },
        priority: "high",
      }),
      createFollowUpTask({
        organizationId: row.organization_id,
        clientId: client.clientId,
        title: "Preparar y realizar llamada comercial",
        dueAt: startsAt,
        idempotencyKey: `booking_call:${externalId}`,
        payload: { action_type: "booking_call", booking_id: bookingRow.id, lead_id: leadId, event_type: eventType, status },
        priority: "normal",
      }),
    ]);
    await createClientTimelineEvent({
      organizationId: row.organization_id,
      clientId: client.clientId,
      eventType: "booking.form_reminder_pending",
      title: "Llamada reservada; formulario pendiente",
      payload: { booking_id: bookingRow.id, lead_id: leadId, starts_at: startsAt, fillout_url_configured: Boolean(filloutUrl) },
    });
  }

  return { status: "done", message: "Reserva vinculada al cliente y lead; no se ha creado expediente.", metadata: { booking_id: bookingRow.id, client_id: client.clientId, lead_id: leadId, possible_duplicate_client_id: client.possibleDuplicateClientId } };
}

async function dispatch(row: WorkerRow) {
  if (row.channel === "form" && row.event_type === "lead.created") return form(row);
  if (row.channel === "booking" && row.event_type === "booking.requested") return booking(row);
  if (row.channel === "holded") return handleHoldedOutbox(row);
  return { status: "manual_review", message: "Evento sin automatización aprobada." } as WorkerOutcome;
}

export async function processOutboxBatch(limit = 20): Promise<OutboxWorkerResult> {
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const db = getSupabaseAdminClient();
  const { data: run, error: runError } = await db.from("integration_runs").insert({ integration: "outbox", status: "processing", started_at: new Date().toISOString(), metadata: { limit } }).select("id").single();
  if (runError) return { ok: false, mode: "supabase", error: runError.message };
  const { data: rows, error } = await db.rpc("claim_integration_outbox", { worker_name: `next:${run.id}`, batch_size: Math.max(1, Math.min(limit, 100)) });
  if (error) return { ok: false, mode: "supabase", error: error.message };

  let processed = 0; let failed = 0; let manualReview = 0; const details: unknown[] = [];
  for (const row of (rows || []) as WorkerRow[]) {
    try {
      const outcome = await dispatch(row); const now = new Date().toISOString();
      await db.from("integration_outbox").update({ status: outcome.status, sync_status: outcome.status === "done" ? "synced" : "sync_error", processed_at: outcome.status === "done" ? now : null, last_synced_at: outcome.status === "done" ? now : null, locked_at: null, locked_by: null, last_error: outcome.status === "done" ? null : outcome.message, next_action: outcome.message, next_attempt_at: null }).eq("id", row.id);
      if (outcome.status === "done") processed += 1; else manualReview += 1;
      details.push({ id: row.id, status: outcome.status, message: outcome.message, ...outcome.metadata });
    } catch (caught) {
      failed += 1;
      const message = caught instanceof Error ? caught.message : "worker_error";
      const exhausted = (row.attempts || 0) >= (row.max_attempts || 3);
      const delay = Math.min(60, 2 ** Math.max(1, row.attempts || 1));
      await db.from("integration_outbox").update({ status: exhausted ? "manual_review" : "failed", sync_status: "sync_error", locked_at: null, locked_by: null, last_error: message, next_action: exhausted ? "Revisar manualmente." : "Reintento automático con backoff.", next_attempt_at: exhausted ? null : new Date(Date.now() + delay * 60000).toISOString() }).eq("id", row.id);
      details.push({ id: row.id, status: exhausted ? "manual_review" : "failed", error: message });
    }
  }
  await db.from("integration_runs").update({ status: failed ? "failed" : "done", finished_at: new Date().toISOString(), attempts: 1, metadata: { processed, failed, manualReview, details } }).eq("id", run.id);
  return { ok: true, mode: "supabase", processed, failed, manualReview, runId: run.id, details };
}
