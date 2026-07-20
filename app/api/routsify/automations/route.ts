import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createAutomationRule, listAutomationWorkspace } from "@/lib/automation-rules-server";
import { getRequestUserId, resolveOrganizationId } from "@/lib/request-context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const organizationId = await resolveOrganizationId(request, access.organizationId);
    return NextResponse.json({ ok: true, data: await listAutomationWorkspace(organizationId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "automation_list_failed" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const organizationId = await resolveOrganizationId(request, access.organizationId);
    const [actorId, body] = await Promise.all([getRequestUserId(request), request.json().catch(() => null)]);
    const data = await createAutomationRule(organizationId, actorId, body);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "automation_create_failed" }, { status: 400 });
  }
}
