import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { PROPOSAL_WITH_VERSIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

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

  const admin = getSupabaseAdminClient();
  const { data: operationRows, error: operationError } = await admin.rpc("create_or_get_case_proposal", {
    target_org: access.organizationId,
    target_case: caseId,
    target_actor: access.actorId,
  });
  if (operationError) {
    const status = operationError.message.includes("case_not_found") ? 404 : 400;
    return NextResponse.json({ ok: false, error: operationError.message }, { status });
  }

  const operation = Array.isArray(operationRows) ? operationRows[0] : operationRows;
  const proposalId = String(operation?.proposal_id || "");
  if (!proposalId) return NextResponse.json({ ok: false, error: "proposal_transaction_returned_no_id" }, { status: 500 });

  const { data, error } = await admin
    .from("proposals")
    .select(PROPOSAL_WITH_VERSIONS_SELECT)
    .eq("id", proposalId)
    .eq("organization_id", access.organizationId)
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const created = Boolean(operation?.created);
  return NextResponse.json({ ok: true, mode: "supabase", data, existing: !created }, { status: created ? 201 : 200 });
}
