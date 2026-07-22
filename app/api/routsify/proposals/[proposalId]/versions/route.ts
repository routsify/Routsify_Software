import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

export async function GET(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient()
    .from("proposal_versions")
    .select("*, budget_lines(*)")
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id,case_id,status")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (proposalError) return NextResponse.json({ ok: false, error: proposalError.message }, { status: 400 });
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });

  const { data: latest, error: latestError } = await supabase
    .from("proposal_versions")
    .select("*")
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) return NextResponse.json({ ok: false, error: latestError.message }, { status: 400 });
  if (!latest) return NextResponse.json({ ok: false, error: "proposal_version_not_found" }, { status: 404 });
  const requestedSourceId = String(body.source_version_id || "").trim();
  const sourceVersionId = requestedSourceId || latest.id;
  const { data: revision, error: revisionError } = await supabase.rpc("create_proposal_revision", {
    target_org: organizationId,
    target_proposal: proposalId,
    source_version: sourceVersionId,
    actor: actorId,
  });
  if (revisionError) {
    const conflict = ["editable_version_exists", "signed_contract_requires_amendment"].some((code) => revisionError.message.includes(code));
    return NextResponse.json({ ok: false, error: revisionError.message }, { status: conflict ? 409 : 400 });
  }
  const revisionRow = revision && typeof revision === "object" && !Array.isArray(revision) ? revision as Record<string, unknown> : {};
  const createdId = String(revisionRow.version_id || "");
  if (!createdId) return NextResponse.json({ ok: false, error: "proposal_revision_returned_no_version" }, { status: 500 });
  const { data: full, error: fullError } = await supabase.from("proposal_versions").select("*, budget_lines(*)").eq("id", createdId).eq("organization_id", organizationId).single();
  if (fullError) return NextResponse.json({ ok: false, error: fullError.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: full }, { status: 201 });
}
