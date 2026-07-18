import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { syncFilloutSubmissions } from "@/lib/fillout-api-server";
import { resolveOrganizationId } from "@/lib/request-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const body = await request.json().catch(() => ({}));
  try {
    const data = await syncFilloutSubmissions(organizationId, {
      full: body?.full === true,
      maxPages: Number.isFinite(Number(body?.maxPages)) ? Number(body.maxPages) : undefined,
    });
    return NextResponse.json({ ok: data.ok, data }, { status: data.ok ? 200 : 207 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "fillout_sync_failed" }, { status: 424 });
  }
}
