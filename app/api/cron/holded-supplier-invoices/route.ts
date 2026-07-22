import { NextRequest, NextResponse } from "next/server";
import { runHoldedSupplierInvoiceAutopilot } from "@/lib/jobs-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const schedule = request.headers.get("x-vercel-cron-schedule") || "manual";
  const startedAt = new Date().toISOString();
  const data = await runHoldedSupplierInvoiceAutopilot(schedule === "manual" ? "manual" : "vercel_cron");
  const failed = Number(data.failedOrganizations || 0);
  return NextResponse.json({
    ok: failed === 0,
    schedule,
    startedAt,
    finishedAt: new Date().toISOString(),
    data,
  }, { status: failed === 0 ? 200 : 207 });
}
