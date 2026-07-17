import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { loadThirdPartyIntegrationConfig, updateThirdPartyIntegrationConfig } from "@/lib/third-party-integration-config-server";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const data = await loadThirdPartyIntegrationConfig(access.organizationId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "integration_config_load_failed" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin" && access.role !== "direction") return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  try {
    const data = await updateThirdPartyIntegrationConfig({ organizationId: access.organizationId, actorId: access.actorId, config: body });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "integration_config_update_failed" }, { status: 400 });
  }
}
