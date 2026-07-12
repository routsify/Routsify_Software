import { createHash } from "node:crypto";
import { handleHoldedOutbox, syncHoldedPurchaseCandidates, type WorkerOutcome, type WorkerRow } from "@/lib/holded-outbox-handlers";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
export { syncHoldedPurchaseCandidates };
export type OutboxWorkerResult = { ok: true; mode: "supabase"; processed: number; failed: number; manualReview: number; runId?: string; details: unknown[] } | { ok: false; mode: "supabase"; error: string };
const text = (v: unknown) => String(v || "").trim();

async function form(row: WorkerRow): Promise<WorkerOutcome> {
  const p = row.payload || {}; const email = text(p.email).toLowerCase(); const phone = text(p.phone).replace(/\D/g, ""); const db = getSupabaseAdminClient(); let clientId: string | null = null;
  if (email) { const { data } = await db.from("clients").select("id").eq("organization_id", row.organization_id).eq("email_normalized", email).maybeSingle(); clientId = data?.id || null; }
  if (!clientId && (email || phone)) { const { data, error } = await db.from("clients").upsert({ organization_id: row.organization_id, display_name: text(p.name) || email || "Cliente pendiente", client_type: "person", email: email || null, email_normalized: email || null, phone: text(p.phone) || null, phone_normalized: phone || null, source: "form" }, { onConflict: "organization_id,email_normalized" }).select("id").single(); if (error) throw new Error(error.message); clientId = data.id; }
  const sourceId = text(p.submission_id || p.submissionId || row.id); const redacted = { ...p }; for (const key of ["passport", "document_number", "card_number", "token"]) delete redacted[key];
  const { error } = await db.from("leads").upsert({ organization_id: row.organization_id, client_id: clientId, source: text(p.source) || "form", client_name: text(p.name) || "Lead sin nombre", email: email || null, email_normalized: email || null, phone: text(p.phone) || null, phone_normalized: phone || null, destination: text(p.destination) || null, travel_dates: text(p.travel_dates) || null, travelers: Number(p.travelers || 1), budget_hint: text(p.budget_hint) || null, status: "new", source_submission_id: sourceId, payload_hash: createHash("sha256").update(JSON.stringify(redacted)).digest("hex"), payload_redacted: redacted }, { onConflict: "organization_id,source,source_submission_id" }); if (error) throw new Error(error.message);
  return { status: "done", message: "Solicitud registrada de forma idempotente.", metadata: { client_id: clientId } };
}

async function booking(row: WorkerRow): Promise<WorkerOutcome> {
  const p = row.payload || {}; const externalId = text(p.external_booking_id || p.booking_id || p.id); if (!externalId) throw new Error("external_booking_id_required"); const timestamp = text(p.event_timestamp || p.updated_at || p.created_at) || new Date().toISOString();
  const { error } = await getSupabaseAdminClient().from("bookings").upsert({ organization_id: row.organization_id, external_id: externalId, external_booking_id: externalId, source: text(p.source) || "booking", event_type: text(p.event_type) || "booking.created", event_timestamp: timestamp, starts_at: text(p.starts_at || p.start_time) || null, ends_at: text(p.ends_at || p.end_time) || null, status: text(p.status) || "received", payload: p }, { onConflict: "organization_id,source,external_booking_id,event_type,event_timestamp" }); if (error) throw new Error(error.message);
  return { status: "done", message: "Reserva registrada de forma idempotente." };
}

async function dispatch(row: WorkerRow) {
  if (row.channel === "form" && row.event_type === "lead.created") return form(row);
  if (row.channel === "booking" && row.event_type === "booking.requested") return booking(row);
  if (row.channel === "holded") return handleHoldedOutbox(row);
  return { status: "manual_review", message: "Evento sin automatización aprobada." } as WorkerOutcome;
}

export async function processOutboxBatch(limit = 20): Promise<OutboxWorkerResult> {
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" }; const db = getSupabaseAdminClient();
  const { data: run, error: runError } = await db.from("integration_runs").insert({ integration: "outbox", status: "processing", started_at: new Date().toISOString(), metadata: { limit } }).select("id").single(); if (runError) return { ok: false, mode: "supabase", error: runError.message };
  const { data: rows, error } = await db.rpc("claim_integration_outbox", { worker_name: `next:${run.id}`, batch_size: Math.max(1, Math.min(limit, 100)) }); if (error) return { ok: false, mode: "supabase", error: error.message };
  let processed = 0; let failed = 0; let manualReview = 0; const details: unknown[] = [];
  for (const row of (rows || []) as WorkerRow[]) {
    try { const outcome = await dispatch(row); const now = new Date().toISOString(); await db.from("integration_outbox").update({ status: outcome.status, sync_status: outcome.status === "done" ? "synced" : "sync_error", processed_at: outcome.status === "done" ? now : null, last_synced_at: outcome.status === "done" ? now : null, locked_at: null, locked_by: null, last_error: outcome.status === "done" ? null : outcome.message, next_action: outcome.message, next_attempt_at: null }).eq("id", row.id); if (outcome.status === "done") processed += 1; else manualReview += 1; details.push({ id: row.id, status: outcome.status, message: outcome.message, ...outcome.metadata }); }
    catch (caught) { failed += 1; const message = caught instanceof Error ? caught.message : "worker_error"; const exhausted = (row.attempts || 0) >= (row.max_attempts || 3); const delay = Math.min(60, 2 ** Math.max(1, row.attempts || 1)); await db.from("integration_outbox").update({ status: exhausted ? "manual_review" : "failed", sync_status: "sync_error", locked_at: null, locked_by: null, last_error: message, next_action: exhausted ? "Revisar manualmente." : "Reintento automático con backoff.", next_attempt_at: exhausted ? null : new Date(Date.now() + delay * 60000).toISOString() }).eq("id", row.id); details.push({ id: row.id, status: exhausted ? "manual_review" : "failed", error: message }); }
  }
  await db.from("integration_runs").update({ status: failed ? "failed" : "done", finished_at: new Date().toISOString(), attempts: 1, metadata: { processed, failed, manualReview, details } }).eq("id", run.id);
  return { ok: true, mode: "supabase", processed, failed, manualReview, runId: run.id, details };
}
