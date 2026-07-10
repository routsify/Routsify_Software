import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

const allowedStatuses = new Set(["pending", "requested", "received", "review", "not_required", "cancelled", "expected", "review_needed"]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });
  const { purchaseId } = await params;
  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").select("*").eq("id", purchaseId).maybeSingle();
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

  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").update({ status, review_notes: body?.review_notes || null }).eq("id", purchaseId).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
