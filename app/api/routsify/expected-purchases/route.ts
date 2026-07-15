import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { PURCHASE_WITH_RELATIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

const allowedStatuses = new Set(["expected", "requested", "uploaded", "holded_candidate", "matched", "review_needed", "approved", "not_required", "cancelled"]);

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const { data, error } = await getSupabaseAdminClient()
    .from("expected_purchases")
    .select(PURCHASE_WITH_RELATIONS_SELECT)
    .eq("organization_id", access.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: "supabase", data: data || [] });
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const caseId = String(source.case_id || "").trim();
  const supplierId = String(source.supplier_id || "").trim();
  const service = String(source.service || "").trim();
  const status = String(source.status || "expected");
  const amount = numberValue(source.amount);
  if (!caseId) return NextResponse.json({ ok: false, error: "case_required" }, { status: 400 });
  if (!supplierId) return NextResponse.json({ ok: false, error: "supplier_required" }, { status: 400 });
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  if (amount < 0) return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });

  const organizationId = access.organizationId;
  const supabase = getSupabaseAdminClient();
  const [{ data: caseRow }, { data: supplier }] = await Promise.all([
    supabase.from("cases").select("id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("suppliers").select("id,name,active").eq("id", supplierId).eq("organization_id", organizationId).maybeSingle(),
  ]);
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  if (!supplier) return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404 });
  if (supplier.active === false) return NextResponse.json({ ok: false, error: "supplier_inactive" }, { status: 409 });

  const payload = {
    organization_id: organizationId,
    case_id: caseId,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    service: service || null,
    amount,
    expected_amount: amount,
    currency: String(source.currency || "EUR").toUpperCase(),
    status,
    review_notes: String(source.review_notes || "").trim() || null,
  };
  const { data, error } = await supabase.from("expected_purchases").insert(payload).select(PURCHASE_WITH_RELATIONS_SELECT).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
