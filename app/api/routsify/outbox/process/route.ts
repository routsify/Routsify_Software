import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { processOutboxBatch } from "@/lib/outbox-worker-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => ({})) as { limit?: number };
  const limit = Math.min(Math.max(Number(body.limit || 10), 1), 50);
  const result = await processOutboxBatch(limit);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
