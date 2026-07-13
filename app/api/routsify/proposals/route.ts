import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { PROPOSAL_WITH_VERSIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

async function findProposal(organizationId: string, caseId: string) {
  return getSupabaseAdminClient()
    .from("proposals")
    .select(PROPOSAL_WITH_VERSIONS_SELECT)
    .eq("case_id", caseId)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { data, error } = await getSupabaseAdminClient()
    .from("proposals")
    .select(PROPOSAL_WITH_VERSIONS_SELECT)
    .eq("organization_id", access.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, mode: "supabase", error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: "supabase", data: data || [] });
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const caseId = String((body as Record<string, unknown>).case_id || "").trim();
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 });

  const organizationId = access.organizationId;
  const admin = getSupabaseAdminClient();
  const { data: caseRow, error: caseError } = await admin.from("cases").select("id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const existingResult = await findProposal(organizationId, caseId);
  if (existingResult.error) return NextResponse.json({ ok: false, error: existingResult.error.message }, { status: 400 });
  if (existingResult.data) return NextResponse.json({ ok: true, mode: "supabase", data: existingResult.data, existing: true });

  const { data: proposal, error: proposalError } = await admin
    .from("proposals")
    .insert({ organization_id: organizationId, case_id: caseId, status: "draft" })
    .select("id")
    .single();
  if (proposalError) {
    const raced = await findProposal(organizationId, caseId);
    if (raced.data) return NextResponse.json({ ok: true, mode: "supabase", data: raced.data, existing: true });
    return NextResponse.json({ ok: false, error: proposalError.message }, { status: 400 });
  }

  const { data: version, error: versionError } = await admin
    .from("proposal_versions")
    .insert({ organization_id: organizationId, proposal_id: proposal.id, version_number: 1, status: "draft", total_sale: 0, total_cost: 0, total_cost_budget: 0, budgeted_profit: 0 })
    .select("id")
    .single();
  if (versionError) {
    await admin.from("proposals").delete().eq("id", proposal.id).eq("organization_id", organizationId);
    return NextResponse.json({ ok: false, error: versionError.message }, { status: 400 });
  }

  await admin.from("proposals").update({ current_version_id: version.id, updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("organization_id", organizationId);
  await admin.from("cases").update({ status: "budget_draft", next_action: "Completar presupuesto", updated_at: new Date().toISOString() }).eq("id", caseId).eq("organization_id", organizationId);

  const { data, error } = await admin.from("proposals").select(PROPOSAL_WITH_VERSIONS_SELECT).eq("id", proposal.id).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: "supabase", data, existing: false }, { status: 201 });
}
