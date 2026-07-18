import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { syncFilloutSubmissions } from "@/lib/fillout-api-server";
import { resolveOrganizationId } from "@/lib/request-context";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const body = await request.json().catch(() => ({}));
  try {
    const data = await syncFilloutSubmissions(organizationId, { fullSync: body?.fullSync === true });
    return NextResponse.json(data, { status: data.ok ? 200 : data.status || 500 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "fillout_sync_failed" }, { status: 500 });
  }
}
