import { NextRequest, NextResponse } from "next/server";
import { runAutomationRulesForAllOrganizations } from "@/lib/automation-rules-server";
import { syncFilloutForAllOrganizationsV2 } from "@/lib/fillout-sync-server";
import { recordIntegrationRun } from "@/lib/integration-health-server";
import { runRoutsifyJob, type RoutsifyJob } from "@/lib/jobs-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const jobs: RoutsifyJob[] = [
  "holded_sync_pending",
  "communication_followup_sync",
  "sync_holded_purchases",
  "pre_trip_supplier_check",
  "post_trip_supplier_check",
  "operational_close_check",
  "fiscal_final_invoice_check",
  "privacy_retention_review",
];

type OperationName = RoutsifyJob | "fillout_submission_sync" | "automation_rules_run";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const schedule = request.headers.get("x-vercel-cron-schedule") || "manual";
  const startedAt = new Date().toISOString();
  const results: Array<{ job: OperationName; ok: boolean; data?: unknown; error?: string }> = [];

  try {
    const fillout = await syncFilloutForAllOrganizationsV2();
    results.push({ job: "fillout_submission_sync", ok: fillout.failedOrganizations === 0, data: fillout, error: fillout.failedOrganizations ? "fillout_sync_partial_failure" : undefined });
  } catch (error) {
    results.push({ job: "fillout_submission_sync", ok: false, error: error instanceof Error ? error.message : "fillout_sync_failed" });
  }

  try {
    const automations = await runAutomationRulesForAllOrganizations();
    results.push({ job: "automation_rules_run", ok: automations.failedOrganizations === 0, data: automations, error: automations.failedOrganizations ? "automation_rules_partial_failure" : undefined });
  } catch (error) {
    results.push({ job: "automation_rules_run", ok: false, error: error instanceof Error ? error.message : "automation_rules_failed" });
  }

  for (const job of jobs) {
    const result = await runRoutsifyJob(job);
    results.push(result.ok ? { job, ok: true, data: result.data } : { job, ok: false, error: result.error });
  }

  const failed = results.filter((result) => !result.ok).length;
  const finishedAt = new Date().toISOString();
  const { data: organizations } = await getSupabaseAdminClient().from("organizations").select("id");
  const failedJobs = results.filter((result) => !result.ok).map((result) => result.job);
  await Promise.allSettled((organizations || []).map((organization) => recordIntegrationRun({
    organizationId: String(organization.id),
    integration: "operations_cron",
    kind: "cron",
    status: failed === 0 ? "done" : "failed",
    startedAt,
    finishedAt,
    triggerSource: schedule === "manual" ? "manual" : "vercel_cron",
    summary: `${results.length - failed}/${results.length} procesos completados.`,
    lastError: failedJobs.length ? `Procesos con error: ${failedJobs.join(", ")}` : null,
    metadata: { schedule, completed: results.length - failed, failed, jobs: results.map((result) => ({ job: result.job, ok: result.ok })) },
  })));
  return NextResponse.json({
    ok: failed === 0,
    schedule,
    startedAt,
    finishedAt,
    jobs: results,
    failed,
  }, { status: failed === 0 ? 200 : 207 });
}
