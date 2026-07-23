import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { runRoutsifyJob, type RoutsifyJob } from "@/lib/jobs-server";

const jobs = new Set<RoutsifyJob>(["holded_sync_pending", "communication_followup_sync", "pre_trip_supplier_check", "post_trip_supplier_check", "operational_close_check", "fiscal_final_invoice_check", "privacy_retention_review"]);

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  const job = String(body?.job || "holded_sync_pending") as RoutsifyJob;
  if (!jobs.has(job)) return NextResponse.json({ ok: false, error: "invalid_job" }, { status: 400 });
  const result = await runRoutsifyJob(job);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
