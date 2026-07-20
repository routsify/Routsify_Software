import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getRequestUserId, resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function statusForError(message: string) {
  if (["scenario_not_found", "proposal_not_found", "proposal_version_not_found"].includes(message)) return 404;
  if (["current_version_not_editable", "scenario_has_generated_purchases"].includes(message)) return 409;
  return 400;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string; scenarioId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId, scenarioId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const db = getSupabaseAdminClient();

  const { data: scenario, error: lookupError } = await db.from("proposal_scenarios").select("id,proposal_id").eq("id", scenarioId).eq("proposal_id", proposalId).eq("organization_id", organizationId).maybeSingle();
  if (lookupError) return NextResponse.json({ ok: false, error: lookupError.message }, { status: 400 });
  if (!scenario) return NextResponse.json({ ok: false, error: "scenario_not_found" }, { status: 404 });

  const { data, error } = await db.rpc("apply_proposal_scenario", { target_scenario: scenarioId, target_organization: organizationId, actor: actorId });
  if (error) {
    const message = String(error.message || "scenario_apply_failed").split("\n")[0];
    const known = ["scenario_not_found", "proposal_not_found", "proposal_version_not_found", "current_version_not_editable", "scenario_has_generated_purchases"].find((item) => message.includes(item));
    return NextResponse.json({ ok: false, error: known || message }, { status: statusForError(known || message) });
  }
  return NextResponse.json({ ok: true, data });
}
