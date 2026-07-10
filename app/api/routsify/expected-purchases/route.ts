import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { listPurchasesRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

const allowedStatuses = new Set(["pending", "requested", "received", "review", "not_required", "cancelled"]);

function money(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const result = await listPurchasesRepository();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const supplierName = String((body as { supplier_name?: unknown }).supplier_name || "").trim();
  const service = String((body as { service?: unknown }).service || "").trim();
  const status = String((body as { status?: unknown }).status || "pending");
  if (supplierName.length < 2) return NextResponse.json({ ok: false, error: "supplier_name_required" }, { status: 400 });
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const payload = {
    organization_id: organizationId,
    supplier_name: supplierName,
    service: service || null,
    amount: money((body as { amount?: unknown }).amount),
    currency: String((body as { currency?: unknown }).currency || "EUR"),
    status,
    review_notes: String((body as { review_notes?: unknown }).review_notes || "").trim() || null,
  };

  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").insert(payload).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
