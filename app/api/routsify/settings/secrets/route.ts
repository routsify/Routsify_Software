import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { listOrganizationSecretStatuses } from "@/lib/organization-secrets-server";
import { resolveOrganizationId } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    const data = await listOrganizationSecretStatuses(organizationId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "secret_status_failed" }, { status: 500 });
  }
}
