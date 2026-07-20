import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import {
  integrationHealthIds,
  loadIntegrationHealth,
  retryFailedIntegrationEvents,
  type IntegrationHealthId,
} from "@/lib/integration-health-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const data = await loadIntegrationHealth(access.organizationId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "integration_health_failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null) as { integration?: string } | null;
  if (!body?.integration || !(integrationHealthIds as readonly string[]).includes(body.integration)) {
    return NextResponse.json({ ok: false, error: "unsupported_integration" }, { status: 400 });
  }
  try {
    const data = await retryFailedIntegrationEvents({
      organizationId: access.organizationId,
      integration: body.integration as IntegrationHealthId,
      actorId: access.actorId,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "integration_retry_failed" }, { status: 500 });
  }
}
