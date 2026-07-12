import { queueEligibleFinalInvoices } from "@/lib/fiscal-workflow-server";
import { processHoldedOutboxBatch, syncHoldedPurchaseCandidates } from "@/lib/holded-outbox-worker-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export type RoutsifyJob = "holded_sync_pending" | "sync_holded_purchases" | "pre_trip_supplier_check" | "post_trip_supplier_check" | "operational_close_check" | "fiscal_final_invoice_check" | "privacy_retention_review";

async function createSupplierTasks(mode: "pre" | "post") {
  const supabase = getSupabaseAdminClient(); const today = new Date(); const from = new Date(today); const to = new Date(today);
  if (mode === "pre") { from.setDate(today.getDate() + 3); to.setDate(today.getDate() + 14); } else { from.setDate(today.getDate() - 14); to.setDate(today.getDate() - 1); }
  const { data: cases, error } = await supabase.from("cases").select("id,organization_id,case_code,trip_end").gte("trip_end", from.toISOString().slice(0, 10)).lte("trip_end", to.toISOString().slice(0, 10)).neq("status", "closed"); if (error) throw new Error(error.message);
  let created = 0;
  for (const item of cases || []) {
    const { count } = await supabase.from("expected_purchases").select("id", { count: "exact", head: true }).eq("case_id", item.id).not("status", "in", "(approved,not_required,cancelled)"); if (!count) continue;
    const key = `${mode}_trip_supplier_check:${item.id}:${item.trip_end}`;
    const { error: taskError } = await supabase.from("tasks").upsert({ organization_id: item.organization_id, case_id: item.id, title: mode === "pre" ? `Revisar compras proveedor antes del viaje (${count})` : `Reclamar facturas proveedor pendientes (${count})`, status: "pending", priority: mode === "pre" ? "high" : "urgent", due_at: new Date().toISOString(), idempotency_key: key, payload: { pending_purchases: count, job: `${mode}_trip_supplier_check` } }, { onConflict: "organization_id,idempotency_key" }); if (!taskError) created += 1;
  }
  return { cases: cases?.length || 0, tasks_created_or_updated: created };
}

async function closeChecks() {
  const supabase = getSupabaseAdminClient(); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 5);
  const { data: cases, error } = await supabase.from("cases").select("id,case_code").lte("trip_end", cutoff.toISOString().slice(0, 10)).not("status", "in", "(closed,new_lead,call_booked,call_done,budget_draft,proposal_sent)"); if (error) throw new Error(error.message);
  const results = [];
  for (const item of cases || []) { const { data, error: preflightError } = await supabase.rpc("operational_close_preflight", { target_case: item.id }); results.push({ case_id: item.id, case_code: item.case_code, data, error: preflightError?.message || null }); }
  return results;
}

async function syncPurchaseCandidatesForAllOrganizations() {
  const supabase = getSupabaseAdminClient(); const { data: organizations, error } = await supabase.from("organizations").select("id"); if (error) throw new Error(error.message);
  const results = [];
  for (const organization of organizations || []) {
    try { results.push({ organizationId: organization.id, ok: true, data: await syncHoldedPurchaseCandidates(organization.id) }); }
    catch (error) { results.push({ organizationId: organization.id, ok: false, error: error instanceof Error ? error.message : "holded_purchase_sync_failed" }); }
  }
  return results;
}

async function retentionReview() {
  const supabase = getSupabaseAdminClient(); const now = new Date().toISOString(); const today = now.slice(0, 10);
  const { data: documents, error } = await supabase.from("documents").select("id,organization_id,case_id,owner_type,owner_id,storage_bucket,bucket,storage_path,title,retention_until,purge_after").is("purged_at", null).or(`purge_after.lte.${now},and(purge_after.is.null,retention_until.lte.${today})`).limit(200); if (error) throw new Error(error.message);
  const results: Array<Record<string, unknown>> = [];
  for (const document of documents || []) {
    const bucket = String(document.storage_bucket || document.bucket || "case-documents");
    const { error: removeError } = await supabase.storage.from(bucket).remove([String(document.storage_path)]);
    if (removeError) { results.push({ documentId: document.id, ok: false, error: removeError.message }); continue; }
    const purgedAt = new Date().toISOString();
    const { data: runs } = await supabase.from("ocr_runs").select("id,traveler_id").eq("document_id", document.id).eq("organization_id", document.organization_id);
    const runIds = (runs || []).map((run) => run.id);
    if (runIds.length) {
      await supabase.from("ocr_fields").update({ extracted_value: null, corrected_value: null, review_status: "purged" }).in("ocr_run_id", runIds);
      await supabase.from("ocr_runs").update({ raw_payload_redacted: {}, status: "purged", error: null }).in("id", runIds);
    }
    for (const run of runs || []) if (run.traveler_id) await supabase.from("travelers").update({ document_number: null, document_expires_at: null, document_country: null, document_type: null, issuing_country: null, mrz: null, ocr_status: "purged", ocr_confidence: null, updated_at: purgedAt }).eq("id", run.traveler_id).eq("organization_id", document.organization_id);
    await supabase.from("documents").update({ status: "purged", deleted_at: purgedAt, purged_at: purgedAt, ocr_status: "purged", updated_at: purgedAt }).eq("id", document.id);
    await supabase.from("audit_log").insert({ organization_id: document.organization_id, actor_id: null, entity_type: "document", entity_id: document.id, action: "privacy_retention_purged", before_data: { storage_bucket: bucket, storage_path: document.storage_path, retention_until: document.retention_until }, after_data: { purged_at: purgedAt } });
    results.push({ documentId: document.id, ok: true, purgedAt });
  }
  return { documents_checked: documents?.length || 0, purged: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

export async function runRoutsifyJob(job: RoutsifyJob) {
  if (!hasSupabaseAdminEnv()) return { ok: false as const, error: "supabase_admin_not_configured" };
  try {
    if (job === "holded_sync_pending") {
      const holded = await processHoldedOutboxBatch(30);
      const generic = await processOutboxBatch(50);
      return { ok: generic.ok, job, data: { holded, generic } };
    }
    if (job === "sync_holded_purchases") return { ok: true as const, job, data: await syncPurchaseCandidatesForAllOrganizations() };
    if (job === "pre_trip_supplier_check") return { ok: true as const, job, data: await createSupplierTasks("pre") };
    if (job === "post_trip_supplier_check") return { ok: true as const, job, data: await createSupplierTasks("post") };
    if (job === "operational_close_check") return { ok: true as const, job, data: await closeChecks() };
    if (job === "fiscal_final_invoice_check") return { ok: true as const, job, data: await queueEligibleFinalInvoices() };
    if (job === "privacy_retention_review") return { ok: true as const, job, data: await retentionReview() };
    return { ok: false as const, error: "unknown_job" };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "job_failed" }; }
}
