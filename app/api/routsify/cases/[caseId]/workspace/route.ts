import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { CASE_SUMMARY_PROPOSALS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sections = new Set(["summary", "travelers", "documents", "contract", "purchases", "activity"]);
const NO_STORE_HEADERS = { "cache-control": "private, no-store, max-age=0" };

function roleAllowed(role: string, allowed: string[]) {
  return allowed.includes(role);
}

function ok(data: Record<string, unknown>) {
  return NextResponse.json({ ok: true, data }, { headers: NO_STORE_HEADERS });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const section = request.nextUrl.searchParams.get("section") || "summary";
  if (!sections.has(section)) return NextResponse.json({ ok: false, error: "invalid_workspace_section" }, { status: 400, headers: NO_STORE_HEADERS });

  const organizationId = access.organizationId;
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id,case_code")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400, headers: NO_STORE_HEADERS });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404, headers: NO_STORE_HEADERS });

  if (section === "travelers") {
    if (!roleAllowed(access.role, ["admin", "direction", "sales", "operations"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403, headers: NO_STORE_HEADERS });
    const { data, error } = await supabase.from("travelers")
      .select("id,traveler_type,first_name,last_name,birth_date,nationality,document_country,document_number,document_expires_at,review_status,ocr_status,ocr_confidence")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("created_at");
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE_HEADERS }) : ok({ travelers: data || [] });
  }

  if (section === "documents") {
    if (!roleAllowed(access.role, ["admin", "sales"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403, headers: NO_STORE_HEADERS });
    const [documentsResult, travelersResult] = await Promise.all([
      supabase.from("documents")
        .select("id,title,file_name,type,document_type,status,mime_type,ocr_status,created_at")
        .eq("case_id", caseId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("travelers")
        .select("id,traveler_type,first_name,last_name,birth_date,nationality,document_country,document_number,document_expires_at,review_status,ocr_status,ocr_confidence")
        .eq("case_id", caseId)
        .eq("organization_id", organizationId)
        .order("created_at"),
    ]);
    const error = documentsResult.error || travelersResult.error;
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE_HEADERS }) : ok({ documents: documentsResult.data || [], travelers: travelersResult.data || [] });
  }

  if (section === "contract") {
    if (!roleAllowed(access.role, ["admin", "direction", "sales", "operations", "billing"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403, headers: NO_STORE_HEADERS });
    const [contractsResult, legalDocumentsResult, paymentsResult, fiscalResult] = await Promise.all([
      supabase.from("contracts").select("id,title,status,external_url,legal_document_id,proposal_version_id,signed_at,notes,created_at,legal_documents(id,document_type,title,version_label,file_name,status,is_active)").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("legal_documents").select("id,document_type,title,version_label,file_name,status,is_active,created_at").eq("organization_id", organizationId).eq("status", "ready").eq("is_test", false).order("is_active", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("payments").select("id,payment_reference,amount,currency,method,status,confirmed_at,received_at,created_at").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("billing_documents").select("id,document_type,type,document_number,status,amount,tax_amount,currency,issued_at,created_at").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    ]);
    const error = contractsResult.error || legalDocumentsResult.error || paymentsResult.error || fiscalResult.error;
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE_HEADERS }) : ok({ contracts: contractsResult.data || [], legal_documents: legalDocumentsResult.data || [], payments: paymentsResult.data || [], fiscal_documents: fiscalResult.data || [] });
  }

  if (section === "purchases") {
    if (!roleAllowed(access.role, ["admin", "direction", "sales", "operations", "billing"])) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403, headers: NO_STORE_HEADERS });
    const { data, error } = await supabase.from("expected_purchases").select("id,supplier_name,service,expected_amount,amount,status").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false });
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE_HEADERS }) : ok({ purchases: data || [] });
  }

  if (section === "activity") {
    const [tasksResult, timelineResult] = await Promise.all([
      supabase.from("tasks").select("id,title,status,priority,due_at,payload").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
      supabase.from("timeline_events").select("id,event_type,title,payload,created_at").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    ]);
    const error = tasksResult.error || timelineResult.error;
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE_HEADERS }) : ok({ tasks: tasksResult.data || [], timeline: timelineResult.data || [] });
  }

  const [paymentsResult, purchasesResult, proposalsResult] = await Promise.all([
    supabase.from("payments").select("id,amount,currency,status,confirmed_at").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("expected_purchases").select("id,supplier_name,service,expected_amount,amount,status").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("proposals").select(CASE_SUMMARY_PROPOSALS_SELECT).eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }),
  ]);
  const error = paymentsResult.error || purchasesResult.error || proposalsResult.error;
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE_HEADERS }) : ok({ payments: paymentsResult.data || [], purchases: purchasesResult.data || [], proposals: proposalsResult.data || [] });
}
