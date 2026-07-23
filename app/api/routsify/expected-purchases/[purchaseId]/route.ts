import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";
import { getExpectedPurchase, transitionExpectedPurchase } from "@/lib/expected-purchases-server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });
  const { purchaseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getExpectedPurchase(organizationId, purchaseId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "purchase_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });
  const { purchaseId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "");
  const rawApprovedCost = body?.approved_cost;
  const approvedCost = rawApprovedCost === undefined || rawApprovedCost === null || rawApprovedCost === "" ? null : Number(rawApprovedCost);
  if (approvedCost !== null && (!Number.isFinite(approvedCost) || approvedCost < 0)) return NextResponse.json({ ok: false, error: "invalid_approved_cost" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await transitionExpectedPurchase({
    organizationId,
    purchaseId,
    status,
    actorId: access.actorId,
    reason: typeof body?.reason === "string" ? body.reason : null,
    reviewNotes: typeof body?.review_notes === "string" ? body.review_notes : undefined,
    holdedPurchaseId: typeof body?.holded_purchase_id === "string" ? body.holded_purchase_id : null,
    approvedCost,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : result.error === "purchase_not_found" ? 404 : 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const { purchaseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const db = getSupabaseAdminClient();
  const { data: purchase, error: purchaseError } = await db.from("expected_purchases")
    .select("id,case_id,supplier_id,status,proposal_version_id,budget_line_id,holded_purchase_id,service,supplier_name,created_at")
    .eq("id", purchaseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (purchaseError) return NextResponse.json({ ok: false, error: purchaseError.message }, { status: 400 });
  if (!purchase) return NextResponse.json({ ok: false, error: "purchase_not_found" }, { status: 404 });
  if (purchase.status !== "expected" || purchase.proposal_version_id || purchase.budget_line_id || purchase.holded_purchase_id) {
    return NextResponse.json({ ok: false, error: "purchase_has_protected_history", blockers: { source_or_status: 1 } }, { status: 409 });
  }

  const [invoices, communications, matches, outbox, supplierPayments] = await Promise.all([
    db.from("supplier_invoices").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("expected_purchase_id", purchaseId),
    db.from("communication_followups").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("purchase_id", purchaseId),
    db.from("purchase_match_candidates").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("expected_purchase_id", purchaseId),
    db.from("integration_outbox").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("entity_id", purchaseId),
    db.from("supplier_payment_allocations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("expected_purchase_id", purchaseId),
  ]);
  const dependencyError = [invoices, communications, matches, outbox, supplierPayments].find((result) => result.error)?.error;
  if (dependencyError) return NextResponse.json({ ok: false, error: dependencyError.message }, { status: 400 });
  const blockers = { invoices: invoices.count || 0, communications: communications.count || 0, matches: matches.count || 0, outbox: outbox.count || 0, supplier_payments: supplierPayments.count || 0 };
  if (Object.values(blockers).some((value) => value > 0)) {
    return NextResponse.json({ ok: false, error: "purchase_has_protected_history", blockers }, { status: 409 });
  }

  const { error: deleteError } = await db.from("expected_purchases").delete().eq("id", purchaseId).eq("organization_id", organizationId);
  if (deleteError) return NextResponse.json({ ok: false, error: deleteError.code === "23503" ? "purchase_has_protected_history" : deleteError.message }, { status: deleteError.code === "23503" ? 409 : 400 });
  await db.from("audit_log").insert({ organization_id: organizationId, actor_id: access.actorId, entity_type: "expected_purchase", entity_id: purchaseId, action: "expected_purchase.deleted", before_data: purchase });
  return NextResponse.json({ ok: true, data: { id: purchaseId } });
}
