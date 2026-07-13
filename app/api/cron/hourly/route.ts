import { NextRequest, NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.ROUTSIFY_INTERNAL_API_TOKEN;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const startedAt = new Date().toISOString();
  const outbox = await processOutboxBatch(75);
  return NextResponse.json({ ok: outbox.ok, job: "hourly_operations", startedAt, finishedAt: new Date().toISOString(), outbox }, { status: outbox.ok ? 200 : 500 });
}
