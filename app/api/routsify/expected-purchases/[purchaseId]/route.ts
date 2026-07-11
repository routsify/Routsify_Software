import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { hasSupabaseAdminEnv } from "@/lib/supabase-admin";
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
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await transitionExpectedPurchase({
    organizationId,
    purchaseId,
    status,
    actorId: access.actorId,
    reason: typeof body?.reason === "string" ? body.reason : null,
    reviewNotes: typeof body?.review_notes === "string" ? body.review_notes : undefined,
    holdedPurchaseId: typeof body?.holded_purchase_id === "string" ? body.holded_purchase_id : null,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : result.error === "purchase_not_found" ? 404 : 400 });
}
