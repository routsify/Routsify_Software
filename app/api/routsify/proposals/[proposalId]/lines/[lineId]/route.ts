import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { deleteBudgetLineRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ proposalId: string; lineId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { proposalId, lineId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data: line } = await getSupabaseAdminClient()
    .from("budget_lines")
    .select("id,proposal_version_id,proposal_versions!inner(proposal_id,organization_id,locked,status)")
    .eq("id", lineId)
    .eq("proposal_versions.proposal_id", proposalId)
    .eq("proposal_versions.organization_id", organizationId)
    .maybeSingle();
  if (!line) return NextResponse.json({ ok: false, error: "line_not_found" }, { status: 404 });

  const version = Array.isArray(line.proposal_versions) ? line.proposal_versions[0] : line.proposal_versions;
  if (version?.locked || version?.status === "accepted") return NextResponse.json({ ok: false, error: "proposal_version_locked" }, { status: 409 });

  const result = await deleteBudgetLineRepository(lineId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
