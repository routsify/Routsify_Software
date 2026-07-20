import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { runAutomationRulesForOrganization } from "@/lib/automation-rules-server";
import { resolveOrganizationId } from "@/lib/request-context";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  try {
    const organizationId = await resolveOrganizationId(request, access.organizationId);
    const data = await runAutomationRulesForOrganization(organizationId);
    return NextResponse.json({ ok: data.failed === 0, data }, { status: data.failed === 0 ? 200 : 207 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "automation_run_failed" }, { status: 400 });
  }
}
