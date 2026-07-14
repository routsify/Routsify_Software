import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { CASE_SUMMARY_PROPOSALS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sections = new Set(["summary", "travelers", "documents", "contract", "purchases", "activity"]);

function roleAllowed(role: string, allowed: string[]) {
  return allowed.includes(role);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const section = request.nextUrl.searchParams.get("section") || "summary";
  if (!sections.has(section)) return NextResponse.json({ ok: false, error: "invalid_workspace_section" }, { status: 400 });

  const organizationId = access.organizationId;
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id,case_code")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  if (section === "travelers") {
    if (!roleAllowed(access.role, ["admin", "direction", "sales", "operations"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });
    const { data, error } = await supabase.from("travelers").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at");
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data: { travelers: data || [] } });
  }

  if (section === "documents") {
    if (!roleAllowed(access.role, ["admin", "sales"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });
    const [documentsResult, travelersResult] = await Promise.all([
      supabase.from("documents").select("*").eq("case_id", caseId).eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("travelers").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at"),
    ]);
    const error = documentsResult.error || travelersResult.error;
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data: { documents: documentsResult.data || [], travelers: travelersResult.data || [] } });
  }

  if (section === "contract") {
    if (!roleAllowed(access.role, ["admin", "direction", "sales", "operations", "billing"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });
    const [contractsResult, paymentsResult, fiscalResult] = await Promise.all([
      supabase.from("contracts").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("billing_documents").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    ]);
    const error = contractsResult.error || paymentsResult.error || fiscalResult.error;
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data: { contracts: contractsResult.data || [], payments: paymentsResult.data || [], fiscal_documents: fiscalResult.data || [] } });
  }

  if (section === "purchases") {
    if (!roleAllowed(access.role, ["admin", "direction", "sales", "operations", "billing"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });
    const { data, error } = await supabase.from("expected_purchases").select("id,supplier_name,service,expected_amount,amount,status").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false });
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data: { purchases: data || [] } });
  }

  if (section === "activity") {
    const [tasksResult, timelineResult] = await Promise.all([
      supabase.from("tasks").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("timeline_events").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    ]);
    const error = tasksResult.error || timelineResult.error;
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data: { tasks: tasksResult.data || [], timeline: timelineResult.data || [] } });
  }

  const [paymentsResult, purchasesResult, proposalsResult] = await Promise.all([
    supabase.from("payments").select("id,amount,currency,status,confirmed_at").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("expected_purchases").select("id,supplier_name,service,expected_amount,amount,status").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("proposals").select(CASE_SUMMARY_PROPOSALS_SELECT).eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
  ]);
  const error = paymentsResult.error || purchasesResult.error || proposalsResult.error;
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data: { payments: paymentsResult.data || [], purchases: purchasesResult.data || [], proposals: proposalsResult.data || [] } });
}
