import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createProposalRepository } from "@/lib/server-repositories";
import { listOrganizationProposals } from "@/lib/organization-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const PROPOSAL_SELECT = "id,organization_id,case_id,status,current_version_id,created_at,updated_at,cases(id,case_code,title,destination,trip_start,trip_end,client_id,clients(display_name,email)),proposal_versions(id,proposal_id,version_number,status,locked,created_at,expires_at,total_sale,total_cost,total_cost_budget,budgeted_profit,budget_lines(id,proposal_version_id,stable_line_id,service_type_code,description_public,description_internal,supplier_id,supplier_name,destination_segment,start_date,end_date,cost_budget,margin_applied,sale_price,creates_expected_purchase,sort_order,created_at))";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await listOrganizationProposals(organizationId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const caseId = String((body as Record<string, unknown>).case_id || "").trim();
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const admin = getSupabaseAdminClient();
  const { data: caseRow } = await admin.from("cases").select("id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const { data: existing, error: existingError } = await admin
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("case_id", caseId)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (existing) return NextResponse.json({ ok: true, mode: "supabase", data: existing, existing: true });

  const result = await createProposalRepository({ organization_id: organizationId, case_id: caseId, status: "draft" });
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  await admin.from("cases").update({ status: "budget_draft", next_action: "Completar presupuesto", updated_at: new Date().toISOString() }).eq("id", caseId).eq("organization_id", organizationId);
  return NextResponse.json({ ...result, existing: false }, { status: 201 });
}
