import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createProposalRepository } from "@/lib/server-repositories";
import { listOrganizationProposals } from "@/lib/organization-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await listOrganizationProposals(organizationId);
  return NextResponse.json(result);
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

  const { data: existing } = await admin.from("proposals").select("id").eq("case_id", caseId).eq("organization_id", organizationId).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "proposal_already_exists", proposal_id: existing.id }, { status: 409 });

  const result = await createProposalRepository({ organization_id: organizationId, case_id: caseId, status: "draft" });
  if (result.ok) await admin.from("cases").update({ status: "budget_draft", next_action: "Completar presupuesto", updated_at: new Date().toISOString() }).eq("id", caseId).eq("organization_id", organizationId);
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
