import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { updateCaseRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedStatuses = new Set([
  "new_lead",
  "call_booked",
  "call_done",
  "budget_draft",
  "proposal_sent",
  "proposal_accepted",
  "documentation_approved",
  "contract_ready",
  "contract_signed",
  "payment_confirmed",
  "suppliers_pending",
  "ready_to_close",
  "closed",
]);

type CasePatch = Parameters<typeof updateCaseRepository>[1];

async function validateCriticalStatus(organizationId: string, caseId: string, status: string) {
  const supabase = getSupabaseAdminClient();
  if (status === "proposal_accepted") {
    const { data } = await supabase.from("proposals").select("id,current_version_id").eq("organization_id", organizationId).eq("case_id", caseId).eq("status", "accepted").maybeSingle();
    return data?.current_version_id ? null : "accepted_proposal_required";
  }
  if (status === "documentation_approved") {
    const { data: travelers, error } = await supabase.from("travelers").select("traveler_type,review_status").eq("organization_id", organizationId).eq("case_id", caseId);
    if (error) return error.message;
    if (!travelers?.some((row) => row.traveler_type === "adult")) return "approved_adult_traveler_required";
    if (travelers.some((row) => row.review_status !== "approved")) return "all_travelers_must_be_approved";
    return null;
  }
  if (status === "contract_ready") {
    const { data } = await supabase.from("contracts").select("id,current_version_id").eq("organization_id", organizationId).eq("case_id", caseId).in("status", ["draft", "sent"]).maybeSingle();
    return data?.current_version_id ? null : "contract_version_required";
  }
  if (status === "contract_signed") {
    const { data: contract } = await supabase.from("contracts").select("id,current_version_id").eq("organization_id", organizationId).eq("case_id", caseId).eq("status", "signed").maybeSingle();
    if (!contract?.current_version_id) return "signed_contract_evidence_required";
    const { data: evidence } = await supabase.from("signature_evidence").select("id").eq("organization_id", organizationId).eq("contract_version_id", contract.current_version_id).maybeSingle();
    return evidence ? null : "signed_contract_evidence_required";
  }
  if (status === "payment_confirmed" || status === "suppliers_pending") {
    const [{ data: caseRow }, { data: payments }] = await Promise.all([
      supabase.from("cases").select("accepted_value").eq("organization_id", organizationId).eq("id", caseId).single(),
      supabase.from("payments").select("amount").eq("organization_id", organizationId).eq("case_id", caseId).eq("status", "confirmed"),
    ]);
    const paid = (payments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return paid + 0.005 >= Number(caseRow?.accepted_value || 0) && Number(caseRow?.accepted_value || 0) > 0 ? null : "full_payment_required";
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { caseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data: existing, error: existingError } = await getSupabaseAdminClient()
    .from("cases")
    .select("id,trip_start,trip_end")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const updates: CasePatch = {};
  for (const key of ["title", "destination", "trip_start", "trip_end", "next_action", "blocker", "final_notes"] as const) {
    if (key in source) updates[key] = source[key] ? String(source[key]) : null;
  }

  const tripStart = "trip_start" in source ? (source.trip_start ? String(source.trip_start) : null) : existing.trip_start;
  const tripEnd = "trip_end" in source ? (source.trip_end ? String(source.trip_end) : null) : existing.trip_end;
  if (tripStart && tripEnd && tripStart > tripEnd) return NextResponse.json({ ok: false, error: "invalid_date_range" }, { status: 400 });

  if ("status" in source) {
    const status = String(source.status || "");
    if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    const criticalError = await validateCriticalStatus(organizationId, caseId, status);
    if (criticalError) return NextResponse.json({ ok: false, error: criticalError }, { status: 409 });
    if (status === "ready_to_close" || status === "closed") {
      const admin = getSupabaseAdminClient();
      const { data: preflight, error: preflightError } = await admin.rpc("operational_close_preflight", { target_case: caseId });
      if (preflightError) return NextResponse.json({ ok: false, error: preflightError.message }, { status: 400 });
      const closeResult = preflight as { ready?: boolean; blockers?: unknown[] } | null;
      if (!closeResult?.ready) return NextResponse.json({ ok: false, error: "operational_close_blocked", blockers: closeResult?.blockers || [] }, { status: 409 });
      if (status === "closed") {
        const { error: closeError } = await admin.rpc("close_operational_case", { target_case: caseId, actor: access.actorId });
        if (closeError) return NextResponse.json({ ok: false, error: closeError.message }, { status: 409 });
        const { data: closedCase, error: refreshError } = await admin.from("cases").select("*, clients(display_name,email,phone)").eq("id", caseId).eq("organization_id", organizationId).single();
        if (refreshError) return NextResponse.json({ ok: false, error: refreshError.message }, { status: 400 });
        return NextResponse.json({ ok: true, data: closedCase });
      }
      updates.status = "ready_to_close";
      updates.next_action = "Revisar y cerrar expediente";
    } else {
      updates.status = status;
    }
  }

  const result = await updateCaseRepository(caseId, updates);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
