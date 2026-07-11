import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error: caseError } = await supabase.from("cases").select("*, clients(*)").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const results = await Promise.all([
    supabase.from("travelers").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at"),
    supabase.from("documents").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("timeline_events").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("contracts").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("billing_documents").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("expected_purchases").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("proposals").select("*, proposal_versions(*, budget_lines(*))").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
  ]);
  const error = results.map((result) => result.error).find(Boolean);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const [travelers, documents, tasks, timeline, contracts, payments, fiscal, purchases, proposals] = results.map((result) => result.data || []);
  return NextResponse.json({ ok: true, data: { case: caseRow, travelers, documents, tasks, timeline, contracts, payments, fiscal_documents: fiscal, purchases, proposals } });
}
