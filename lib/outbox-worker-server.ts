import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

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
};

function shouldManualReview(row: OutboxRow) {
  return row.risk === "high" || row.event_type.includes("fiscal") || row.event_type.includes("holded");
}

async function handleOutboxRow(row: OutboxRow) {
  if (shouldManualReview(row)) return { status: "manual_review", message: "Requiere revisión humana antes de automatizar." };
  if (row.channel === "form" && row.event_type === "lead.created") return { status: "done", message: "Lead preparado para conversión real." };
  if (row.channel === "booking" && row.event_type === "booking.requested") return { status: "done", message: "Booking preparado como solicitud real." };
  if (row.channel === "payment" && row.event_type === "payment.manual_confirmed") return { status: "manual_review", message: "Pago confirmado; fiscalidad queda en manual_review." };
  return { status: "manual_review", message: "Canal no automatizado todavía." };
}

export async function processOutboxBatch(limit = 10): Promise<OutboxWorkerResult> {
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };

  const supabase = getSupabaseAdminClient();
  const { data: run, error: runError } = await supabase.from("integration_runs").insert({ integration: "outbox", status: "processing", started_at: new Date().toISOString(), metadata: { limit } }).select("id").single();
  if (runError) return { ok: false, mode: "supabase", error: runError.message };

  const { data: rows, error } = await supabase
    .from("integration_outbox")
    .select("id,organization_id,channel,event_type,status,attempts,max_attempts,payload,risk")
    .in("status", ["pending", "queued", "failed"])
    .lt("attempts", 10)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { ok: false, mode: "supabase", error: error.message };

  let processed = 0;
  let failed = 0;
  let manualReview = 0;
  const details: unknown[] = [];

  for (const raw of rows || []) {
    const row = raw as OutboxRow;
    const claim = await supabase.from("integration_outbox").update({ status: "processing", attempts: (row.attempts || 0) + 1, last_attempt_at: new Date().toISOString() }).eq("id", row.id).in("status", ["pending", "queued", "failed"]);
    if (claim.error) { failed += 1; details.push({ id: row.id, error: claim.error.message }); continue; }

    try {
      const outcome = await handleOutboxRow(row);
      const finalStatus = outcome.status;
      await supabase.from("integration_outbox").update({ status: finalStatus, last_error: finalStatus === "done" ? null : outcome.message, next_action: outcome.message }).eq("id", row.id);
      if (finalStatus === "done") processed += 1; else manualReview += 1;
      details.push({ id: row.id, status: finalStatus, message: outcome.message });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "unknown_worker_error";
      await supabase.from("integration_outbox").update({ status: "failed", last_error: message, next_action: "Revisar error del worker y reintentar." }).eq("id", row.id);
      details.push({ id: row.id, status: "failed", error: message });
    }
  }

  await supabase.from("integration_runs").update({ status: failed ? "failed" : "done", finished_at: new Date().toISOString(), attempts: 1, metadata: { processed, failed, manualReview, details } }).eq("id", run.id);
  return { ok: true, mode: "supabase", processed, failed, manualReview, runId: run.id, details };
}
