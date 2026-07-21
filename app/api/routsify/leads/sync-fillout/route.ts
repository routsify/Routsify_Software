import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { syncFilloutSubmissionsV2 } from "@/lib/fillout-sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => ({}));
  try {
    const data = await syncFilloutSubmissionsV2(access.organizationId, {
      full: false,
      maxPages: Math.min(2, Math.max(1, Number(body?.maxPages || 2))),
    });
    return NextResponse.json({ ok: data.ok, data }, { status: data.ok ? 200 : 207 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "fillout_sync_failed" }, { status: 424 });
  }
}
