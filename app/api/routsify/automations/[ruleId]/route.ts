import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { deleteAutomationRule, updateAutomationRule } from "@/lib/automation-rules-server";
import { getRequestUserId, resolveOrganizationId } from "@/lib/request-context";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const [{ ruleId }, organizationId, actorId, body] = await Promise.all([params, resolveOrganizationId(request, access.organizationId), getRequestUserId(request), request.json().catch(() => null)]);
    const data = await updateAutomationRule(organizationId, ruleId, actorId, body);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "automation_update_failed" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const [{ ruleId }, organizationId] = await Promise.all([params, resolveOrganizationId(request, access.organizationId)]);
    await deleteAutomationRule(organizationId, ruleId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "automation_delete_failed" }, { status: 400 });
  }
}
