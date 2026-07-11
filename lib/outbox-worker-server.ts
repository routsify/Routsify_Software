import { createHash } from "node:crypto";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { holdedRequest } from "@/lib/holded-server";

export type OutboxWorkerResult = { ok: true; mode: "supabase"; processed: number; failed: number; manualReview: number; runId?: string; details: unknown[] } | { ok: false; mode: "supabase"; error: string };

type OutboxRow = {
  id: string;
  organization_id: string;
  channel: string;
  event_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
  risk?: string;
  related_case_id?: string | null;
};

type Outcome = { status: "done" | "manual_review"; message: string; metadata?: Record<string, unknown> };

function text(value: unknown) { return String(value || "").trim(); }
function normalizeEmail(value: unknown) { return text(value).toLowerCase(); }
function normalizePhone(value: unknown) { return text(value).replace(/\D/g, ""); }
function payloadHash(payload: Record<string, unknown>) { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }

type ClientResolution = { clientId: string | null; possibleDuplicateClientId: string | null };

async function createDuplicateReviewTask(row: OutboxRow, possibleDuplicateClientId: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient();
  const email = normalizeEmail(payload.email || (payload.customer as Record<string, unknown> | undefined)?.email);
  const phone = normalizePhone(payload.phone || (payload.customer as Record<string, unknown> | undefined)?.phone);
  const fingerprint = createHash("sha256").update(`${row.organization_id}:${email}:${phone}:${possibleDuplicateClientId}`).digest("hex");
  const { error } = await supabase.from("tasks").upsert({
    organization_id: row.organization_id,
    client_id: possibleDuplicateClientId,
    title: "Revisar posible cliente duplicado",
    status: "open",
    priority: "high",
    blocker: "El teléfono coincide con un cliente existente, pero el email es diferente.",
    idempotency_key: `client-dedupe:${fingerprint}`,
    payload: { possible_duplicate_client_id: possibleDuplicateClientId, incoming_email: email || null, incoming_phone: phone || null, source: row.channel },
  }, { onConflict: "organization_id,idempotency_key" });
  if (error) throw new Error(error.message);
}

async function findOrCreateClient(row: OutboxRow, payload: Record<string, unknown>): Promise<ClientResolution> {
  const supabase = getSupabaseAdminClient();
  const email = normalizeEmail(payload.email || (payload.customer as Record<string, unknown> | undefined)?.email);
  const phoneRaw = payload.phone || (payload.customer as Record<string, unknown> | undefined)?.phone;
  const phone = normalizePhone(phoneRaw);

  if (email) {
    const { data: emailMatch, error: emailError } = await supabase.from("clients").select("id").eq("organization_id", row.organization_id).eq("email_normalized", email).maybeSingle();
    if (emailError) throw new Error(emailError.message);
    if (emailMatch?.id) return { clientId: emailMatch.id as string, possibleDuplicateClientId: null };
  }

  if (phone) {
    const { data: phoneMatch, error: phoneError } = await supabase.from("clients").select("id,email_normalized").eq("organization_id", row.organization_id).eq("phone_normalized", phone).maybeSingle();
    if (phoneError) throw new Error(phoneError.message);
    if (phoneMatch?.id) {
      if (email && normalizeEmail(phoneMatch.email_normalized) !== email) {
        await createDuplicateReviewTask(row, phoneMatch.id as string, payload);
        return { clientId: null, possibleDuplicateClientId: phoneMatch.id as string };
      }
      return { clientId: phoneMatch.id as string, possibleDuplicateClientId: null };
    }
  }

  if (!email && !phone) return { clientId: null, possibleDuplicateClientId: null };
  const displayName = text(payload.name || payload.display_name || (payload.customer as Record<string, unknown> | undefined)?.name || email || "Cliente pendiente");
  const { data, error } = await supabase.from("clients").insert({
    organization_id: row.organization_id,
    display_name: displayName,
    client_type: "person",
    email: email || null,
    email_normalized: email || null,
    phone: text(phoneRaw) || null,
    phone_normalized: phone || null,
    source: row.channel,
  }).select("id").single();
  if (error) {
    if (email) {
      const { data: retryEmail } = await supabase.from("clients").select("id").eq("organization_id", row.organization_id).eq("email_normalized", email).maybeSingle();
      if (retryEmail?.id) return { clientId: retryEmail.id as string, possibleDuplicateClientId: null };
    }
    if (phone) {
      const { data: retryPhone } = await supabase.from("clients").select("id,email_normalized").eq("organization_id", row.organization_id).eq("phone_normalized", phone).maybeSingle();
      if (retryPhone?.id) {
        if (email && normalizeEmail(retryPhone.email_normalized) !== email) {
          await createDuplicateReviewTask(row, retryPhone.id as string, payload);
          return { clientId: null, possibleDuplicateClientId: retryPhone.id as string };
        }
        return { clientId: retryPhone.id as string, possibleDuplicateClientId: null };
      }
    }
    throw new Error(error.message);
  }
  return { clientId: data.id as string, possibleDuplicateClientId: null };
}

async function handleForm(row: OutboxRow): Promise<Outcome> {
  const payload = row.payload || {};
  const clientResolution = await findOrCreateClient(row, payload);
  const clientId = clientResolution.clientId;
  const submissionId = text(payload.submission_id || payload.submissionId || row.id);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const redacted = { ...payload };
  for (const key of ["passport", "document_number", "card_number", "token"]) delete redacted[key];
  const { data, error } = await getSupabaseAdminClient().from("leads").upsert({
    organization_id: row.organization_id,
    client_id: clientId,
    possible_duplicate_client_id: clientResolution.possibleDuplicateClientId,
    source: text(payload.source) || "form",
    client_name: text(payload.name || payload.display_name) || "Lead sin nombre",
    email: email || null,
    email_normalized: email || null,
    phone: text(payload.phone) || null,
    phone_normalized: phone || null,
    destination: text(payload.destination) || null,
    travel_dates: text(payload.travel_dates) || null,
    travelers: Number(payload.travelers || 1),
    budget_hint: text(payload.budget_hint) || null,
    status: "new",
    source_submission_id: submissionId,
    payload_hash: payloadHash(redacted),
    payload_redacted: redacted,
    campaign: text(payload.campaign) || null,
  }, { onConflict: "organization_id,source,source_submission_id" }).select("id").single();
  if (error) throw new Error(error.message);
  return { status: "done", message: "Solicitud deduplicada y registrada.", metadata: { lead_id: data.id, client_id: clientId, possible_duplicate_client_id: clientResolution.possibleDuplicateClientId } };
}

async function handleBooking(row: OutboxRow): Promise<Outcome> {
  const payload = row.payload || {};
  const clientResolution = await findOrCreateClient(row, payload);
  const clientId = clientResolution.clientId;
  const externalBookingId = text(payload.external_booking_id || payload.booking_id || payload.id);
  if (!externalBookingId) throw new Error("external_booking_id_required");
  const eventType = text(payload.event_type) || "booking.created";
  const eventTimestamp = text(payload.event_timestamp || payload.updated_at || payload.created_at) || new Date().toISOString();
  const { data, error } = await getSupabaseAdminClient().from("bookings").upsert({
    organization_id: row.organization_id,
    client_id: clientId,
    possible_duplicate_client_id: clientResolution.possibleDuplicateClientId,
    external_id: externalBookingId,
    external_booking_id: externalBookingId,
    source: text(payload.source) || "booking",
    event_type: eventType,
    event_timestamp: eventTimestamp,
    starts_at: text(payload.starts_at || payload.start_time) || null,
    ends_at: text(payload.ends_at || payload.end_time) || null,
    status: text(payload.status) || "received",
    payload,
  }, { onConflict: "organization_id,source,external_booking_id,event_type,event_timestamp" }).select("id").single();
  if (error) throw new Error(error.message);
  return { status: "done", message: "Reserva de llamada registrada de forma idempotente.", metadata: { booking_id: data.id, client_id: clientId, possible_duplicate_client_id: clientResolution.possibleDuplicateClientId } };
}

async function handleHoldedPurchase(row: OutboxRow): Promise<Outcome> {
  const purchaseId = text(row.payload.expected_purchase_id);
  if (!purchaseId) throw new Error("expected_purchase_id_required");
  const purchasesPath = process.env.HOLDED_PURCHASES_PATH;
  if (!purchasesPath) return { status: "manual_review", message: "Configura HOLDED_PURCHASES_PATH tras validar el endpoint disponible en la cuenta Holded." };
  const supabase = getSupabaseAdminClient();
  const { data: purchase, error } = await supabase.from("expected_purchases").select("*, supplier_invoices(*), suppliers(holded_contact_id)").eq("id", purchaseId).eq("organization_id", row.organization_id).maybeSingle();
  if (error || !purchase) throw new Error(error?.message || "expected_purchase_not_found");
  const result = await holdedRequest({ method: "POST", path: purchasesPath, body: {
    contactId: purchase.suppliers?.holded_contact_id || undefined,
    desc: purchase.service,
    date: purchase.invoice_date || undefined,
    subtotal: Number(purchase.invoice_base || purchase.expected_amount || purchase.amount || 0),
    total: Number(purchase.invoice_total || purchase.expected_amount || purchase.amount || 0),
    notes: `ROUTSIFY_CASE_ID:${purchase.case_id}; ROUTSIFY_BUDGET_LINE_ID:${purchase.budget_line_id || ""}`,
  } });
  if (!result.ok) throw new Error(`holded_http_${result.status}`);
  const payload = result.payload as Record<string, unknown> | null;
  const holdedId = text(payload?.id || payload?._id);
  await supabase.from("expected_purchases").update({ holded_purchase_id: holdedId || null, sync_status: holdedId ? "synced" : "manual_review", sync_error: holdedId ? null : "holded_id_missing", last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", purchaseId);
  return { status: holdedId ? "done" : "manual_review", message: holdedId ? "Compra sincronizada con Holded." : "Holded respondió sin identificador; revisar manualmente.", metadata: { holded_purchase_id: holdedId || null } };
}

async function handleOutboxRow(row: OutboxRow): Promise<Outcome> {
  if (row.channel === "form" && row.event_type === "lead.created") return handleForm(row);
  if (row.channel === "booking" && row.event_type === "booking.requested") return handleBooking(row);
  if (row.channel === "holded" && row.event_type === "purchase.sync") return handleHoldedPurchase(row);
  if (row.channel === "payment" && row.event_type.includes("confirmed")) return { status: "manual_review", message: "Pago confirmado; el modo fiscal permanece en manual_review." };
  return { status: "manual_review", message: "Evento sin automatización aprobada; requiere revisión humana." };
}

export async function processOutboxBatch(limit = 20): Promise<OutboxWorkerResult> {
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const supabase = getSupabaseAdminClient();
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase.from("integration_runs").insert({ integration: "outbox", status: "processing", started_at: startedAt, metadata: { limit } }).select("id").single();
  if (runError) return { ok: false, mode: "supabase", error: runError.message };

  const { data: rows, error } = await supabase.rpc("claim_integration_outbox", { worker_name: `next:${run.id}`, batch_size: Math.max(1, Math.min(limit, 100)) });
  if (error) return { ok: false, mode: "supabase", error: error.message };

  let processed = 0;
  let failed = 0;
  let manualReview = 0;
  const details: unknown[] = [];
  for (const row of (rows || []) as OutboxRow[]) {
    try {
      const outcome = await handleOutboxRow(row);
      const now = new Date().toISOString();
      await supabase.from("integration_outbox").update({ status: outcome.status, processed_at: outcome.status === "done" ? now : null, last_synced_at: outcome.status === "done" ? now : null, locked_at: null, locked_by: null, last_error: outcome.status === "done" ? null : outcome.message, next_action: outcome.message, next_attempt_at: null }).eq("id", row.id);
      if (outcome.status === "done") processed += 1; else manualReview += 1;
      details.push({ id: row.id, status: outcome.status, message: outcome.message, ...outcome.metadata });
    } catch (caught) {
      failed += 1;
      const message = caught instanceof Error ? caught.message : "unknown_worker_error";
      const exhausted = (row.attempts || 0) >= (row.max_attempts || 3);
      const delayMinutes = Math.min(60, 2 ** Math.max(1, row.attempts || 1));
      await supabase.from("integration_outbox").update({ status: exhausted ? "manual_review" : "failed", locked_at: null, locked_by: null, last_error: message, next_action: exhausted ? "Revisar manualmente: reintentos agotados." : "Reintento automático con backoff.", next_attempt_at: exhausted ? null : new Date(Date.now() + delayMinutes * 60_000).toISOString() }).eq("id", row.id);
      details.push({ id: row.id, status: exhausted ? "manual_review" : "failed", error: message });
    }
  }

  await supabase.from("integration_runs").update({ status: failed ? "failed" : "done", finished_at: new Date().toISOString(), attempts: 1, metadata: { processed, failed, manualReview, details } }).eq("id", run.id);
  return { ok: true, mode: "supabase", processed, failed, manualReview, runId: run.id, details };
}
