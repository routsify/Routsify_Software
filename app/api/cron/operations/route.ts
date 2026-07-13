import { NextRequest, NextResponse } from "next/server";
import { runRoutsifyJob, type RoutsifyJob } from "@/lib/jobs-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const hourlyJobs: RoutsifyJob[] = ["holded_sync_pending"];
const dailyJobs: RoutsifyJob[] = [
  "sync_holded_purchases",
  "pre_trip_supplier_check",
  "post_trip_supplier_check",
  "operational_close_check",
  "fiscal_final_invoice_check",
];
const monthlyJobs: RoutsifyJob[] = ["privacy_retention_review"];

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const schedule = request.headers.get("x-vercel-cron-schedule") || "manual";
  const jobs = schedule === "15 6 1 * *" ? [...dailyJobs, ...monthlyJobs] : schedule === "15 6 * * *" ? dailyJobs : hourlyJobs;
  const startedAt = new Date().toISOString();
  const results: Array<{ job: RoutsifyJob; ok: boolean; data?: unknown; error?: string }> = [];

  for (const job of jobs) {
    const result = await runRoutsifyJob(job);
    results.push(result.ok ? { job, ok: true, data: result.data } : { job, ok: false, error: result.error });
  }

  const failed = results.filter((result) => !result.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    schedule,
    startedAt,
    finishedAt: new Date().toISOString(),
    jobs: results,
    failed,
  }, { status: failed === 0 ? 200 : 207 });
}
