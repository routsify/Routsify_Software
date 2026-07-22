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
  "contract_ready",
  "contract_signed",
  "payment_confirmed",
  "suppliers_pending",
  "ready_to_close",
  "closed",
]);

type CasePatch = Parameters<typeof updateCaseRepository>[1];

async function validateAdvancedStatus(input: { organizationId: string; caseId: string; status: string; acceptedValue: number }) {
  const db = getSupabaseAdminClient();
  if (input.status === "proposal_sent" || input.status === "proposal_accepted") {
    const allowedProposalStatuses = input.status === "proposal_sent" ? ["sent", "accepted"] : ["accepted"];
    const { count, error } = await db.from("proposals").select("id", { count: "exact", head: true }).eq("organization_id", input.organizationId).eq("case_id", input.caseId).in("status", allowedProposalStatuses);
    if (error) return error.message;
    if (!count) return input.status === "proposal_sent" ? "proposal_must_be_sent_from_budget" : "proposal_must_be_accepted";
  }
  if (input.status === "contract_ready" || input.status === "contract_signed") {
    let query = db.from("contracts").select("id", { count: "exact", head: true }).eq("organization_id", input.organizationId).eq("case_id", input.caseId);
    if (input.status === "contract_signed") query = query.eq("status", "signed");
    const { count, error } = await query;
    if (error) return error.message;
    if (!count) return input.status === "contract_signed" ? "signed_contract_required" : "contract_required";
  }
  if (input.status === "payment_confirmed" || input.status === "suppliers_pending") {
    const { data, error } = await db.from("payments").select("amount,status").eq("organization_id", input.organizationId).eq("case_id", input.caseId).in("status", ["confirmed", "paid", "received"]);
    if (error) return error.message;
    const paid = (data || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (input.acceptedValue <= 0 || paid < input.acceptedValue) return "confirmed_payment_required";
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { caseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const db = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await db
    .from("cases")
    .select("id,status,trip_start,trip_end,accepted_value")
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

  let requestedStatus: string | null = null;
  if ("status" in source) {
    requestedStatus = String(source.status || "");
    if (!allowedStatuses.has(requestedStatus)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    if (["proposal_sent", "proposal_accepted", "contract_ready", "contract_signed", "payment_confirmed", "suppliers_pending"].includes(requestedStatus)) {
      const validationError = await validateAdvancedStatus({ organizationId, caseId, status: requestedStatus, acceptedValue: Number(existing.accepted_value || 0) });
      if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 409 });
    }
    if (requestedStatus === "ready_to_close" || requestedStatus === "closed") {
      const { data: preflight, error: preflightError } = await db.rpc("operational_close_preflight", { target_case: caseId });
      if (preflightError) return NextResponse.json({ ok: false, error: preflightError.message }, { status: 400 });
      const closeResult = preflight as { ready?: boolean; blockers?: string[] } | null;
      if (!closeResult?.ready) return NextResponse.json({ ok: false, error: "operational_close_blocked", blockers: closeResult?.blockers || [] }, { status: 409 });
      updates.status = requestedStatus;
      updates.next_action = requestedStatus === "closed" ? "Expediente cerrado" : "Revisar y cerrar expediente";
      if (requestedStatus === "closed") await db.from("cases").update({ operational_closed_at: new Date().toISOString(), closed_at: new Date().toISOString() }).eq("id", caseId).eq("organization_id", organizationId);
    } else {
      updates.status = requestedStatus;
    }
  }

  const result = await updateCaseRepository(caseId, updates);
  if (result.ok && requestedStatus && requestedStatus !== existing.status) {
    await db.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: "case.status_changed", title: `Estado actualizado a ${requestedStatus}`, payload: { previous_status: existing.status, next_status: requestedStatus }, created_by: access.actorId });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { caseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const db = getSupabaseAdminClient();
  const { data: caseRow, error: caseError } = await db.from("cases")
    .select("id,case_code,title,status,client_id")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const deletableStatuses = new Set(["new_lead", "call_booked", "call_done", "budget_draft"]);
  if (!deletableStatuses.has(String(caseRow.status))) return NextResponse.json({ ok: false, error: "case_has_protected_history", blockers: { status: 1 } }, { status: 409 });

  const [proposals, contracts, payments, paymentLinks, purchases, billing, fiscal, travelers, tasks, timeline, communications, incidents, documentsByCase, documentsByOwner, outbox] = await Promise.all([
    db.from("proposals").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("contracts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("payments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("payment_links").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("expected_purchases").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("billing_documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("fiscal_documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("travelers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("timeline_events").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("communication_followups").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("supplier_incidents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("case_id", caseId),
    db.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("owner_type", "case").eq("owner_id", caseId),
    db.from("integration_outbox").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("entity_id", caseId),
  ]);
  const dependencyError = [proposals, contracts, payments, paymentLinks, purchases, billing, fiscal, travelers, tasks, timeline, communications, incidents, documentsByCase, documentsByOwner, outbox].find((result) => result.error)?.error;
  if (dependencyError) return NextResponse.json({ ok: false, error: dependencyError.message }, { status: 400 });
  const blockers = {
    proposals: proposals.count || 0,
    contracts: contracts.count || 0,
    payments: (payments.count || 0) + (paymentLinks.count || 0),
    purchases: purchases.count || 0,
    fiscal_documents: (billing.count || 0) + (fiscal.count || 0),
    travelers: travelers.count || 0,
    tasks: tasks.count || 0,
    timeline: timeline.count || 0,
    communications: communications.count || 0,
    incidents: incidents.count || 0,
    documents: (documentsByCase.count || 0) + (documentsByOwner.count || 0),
    outbox: outbox.count || 0,
  };
  if (Object.values(blockers).some((value) => value > 0)) return NextResponse.json({ ok: false, error: "case_has_protected_history", blockers }, { status: 409 });

  const { error: deleteError } = await db.from("cases").delete().eq("id", caseId).eq("organization_id", organizationId);
  if (deleteError) return NextResponse.json({ ok: false, error: deleteError.code === "23503" ? "case_has_protected_history" : deleteError.message }, { status: deleteError.code === "23503" ? 409 : 400 });
  await db.from("audit_log").insert({ organization_id: organizationId, actor_id: access.actorId, entity_type: "case", entity_id: caseId, action: "case.deleted", before_data: caseRow });
  return NextResponse.json({ ok: true, data: { id: caseId } });
}
