import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { loadCommunicationCadenceSettings, updateCommunicationCadenceSettings } from "@/lib/communication-settings-server";

function canManageConfiguration(role: string) {
  return role === "admin" || role === "direction";
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const data = await loadCommunicationCadenceSettings(access.organizationId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "communication_settings_load_failed" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!canManageConfiguration(access.role)) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  try {
    const data = await updateCommunicationCadenceSettings({
      organizationId: access.organizationId,
      actorId: access.actorId,
      settings: body,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "communication_settings_update_failed" }, { status: 400 });
  }
}
