import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { processOutboxBatch } from "@/lib/outbox-worker-server";

export type RoutsifyJob = "holded_sync_pending" | "sync_holded_purchases" | "pre_trip_supplier_check" | "post_trip_supplier_check" | "operational_close_check" | "privacy_retention_review";

async function createSupplierTasks(mode: "pre" | "post") {
  const supabase = getSupabaseAdminClient();
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  if (mode === "pre") { from.setDate(today.getDate() + 3); to.setDate(today.getDate() + 14); }
  else { from.setDate(today.getDate() - 14); to.setDate(today.getDate() - 1); }
  const { data: cases, error } = await supabase.from("cases").select("id,organization_id,case_code,trip_end").gte("trip_end", from.toISOString().slice(0, 10)).lte("trip_end", to.toISOString().slice(0, 10)).neq("status", "closed");
  if (error) throw new Error(error.message);
  let created = 0;
  for (const item of cases || []) {
    const { count } = await supabase.from("expected_purchases").select("id", { count: "exact", head: true }).eq("case_id", item.id).not("status", "in", "(approved,not_required,cancelled)");
    if (!count) continue;
    const key = `${mode}_trip_supplier_check:${item.id}:${item.trip_end}`;
    const { error: taskError } = await supabase.from("tasks").upsert({ organization_id: item.organization_id, case_id: item.id, title: mode === "pre" ? `Revisar compras proveedor antes del viaje (${count})` : `Reclamar facturas proveedor pendientes (${count})`, status: "pending", priority: mode === "pre" ? "high" : "urgent", due_at: new Date().toISOString(), idempotency_key: key, payload: { pending_purchases: count, job: `${mode}_trip_supplier_check` } }, { onConflict: "organization_id,idempotency_key" });
    if (!taskError) created += 1;
  }
  return { cases: cases?.length || 0, tasks_created_or_updated: created };
}

async function closeChecks() {
  const supabase = getSupabaseAdminClient();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 5);
  const { data: cases, error } = await supabase.from("cases").select("id,case_code").lte("trip_end", cutoff.toISOString().slice(0, 10)).not("status", "in", "(closed,new_lead,call_booked,call_done,budget_draft,proposal_sent)");
  if (error) throw new Error(error.message);
  const results = [];
  for (const item of cases || []) {
    const { data, error: preflightError } = await supabase.rpc("operational_close_preflight", { target_case: item.id });
    results.push({ case_id: item.id, case_code: item.case_code, data, error: preflightError?.message || null });
  }
  return results;
}

async function retentionReview() {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("documents").update({ status: "retention_review" }).lt("retention_until", now).is("deleted_at", null).neq("status", "retention_review").select("id,organization_id,case_id,title");
  if (error) throw new Error(error.message);
  return { documents_flagged: data?.length || 0 };
}

export async function runRoutsifyJob(job: RoutsifyJob) {
  if (!hasSupabaseAdminEnv()) return { ok: false as const, error: "supabase_admin_not_configured" };
  try {
    if (job === "holded_sync_pending" || job === "sync_holded_purchases") return { ok: true as const, job, data: await processOutboxBatch(50) };
    if (job === "pre_trip_supplier_check") return { ok: true as const, job, data: await createSupplierTasks("pre") };
    if (job === "post_trip_supplier_check") return { ok: true as const, job, data: await createSupplierTasks("post") };
    if (job === "operational_close_check") return { ok: true as const, job, data: await closeChecks() };
    if (job === "privacy_retention_review") return { ok: true as const, job, data: await retentionReview() };
    return { ok: false as const, error: "unknown_job" };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "job_failed" };
  }
}
