import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

const allowedStatuses = new Set(["expected", "requested", "uploaded", "holded_candidate", "matched", "review_needed", "approved", "not_required", "cancelled"]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });
  const { purchaseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").select("*, cases(case_code,title)").eq("id", purchaseId).eq("organization_id", organizationId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "purchase_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const { purchaseId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "");
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (body && "review_notes" in body) patch.review_notes = body.review_notes || null;
  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").update(patch).eq("id", purchaseId).eq("organization_id", organizationId).select("*, cases(case_code,title)").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
