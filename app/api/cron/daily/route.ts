import { NextRequest, NextResponse } from "next/server";
import { runRoutsifyJob, type RoutsifyJob } from "@/lib/jobs-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dailyJobs: RoutsifyJob[] = [
  "pre_trip_supplier_check",
  "post_trip_supplier_check",
  "operational_close_check",
  "fiscal_final_invoice_check",
  "privacy_retention_review",
];

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.ROUTSIFY_INTERNAL_API_TOKEN;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const startedAt = new Date().toISOString();
  const results: Array<{ job: RoutsifyJob; ok: boolean; data?: unknown; error?: string }> = [];
  for (const job of dailyJobs) {
    const result = await runRoutsifyJob(job);
    results.push(result.ok ? { job, ok: true, data: result.data } : { job, ok: false, error: result.error });
  }
  const failed = results.filter((item) => !item.ok);
  return NextResponse.json({ ok: failed.length === 0, job: "daily_operations", startedAt, finishedAt: new Date().toISOString(), failed: failed.length, results }, { status: failed.length ? 207 : 200 });
}
