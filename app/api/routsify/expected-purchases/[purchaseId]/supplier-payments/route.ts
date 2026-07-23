import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { registerManualSupplierPayment } from "@/lib/supplier-payments-server";
import { hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });
  if (!["admin", "direction", "operations", "billing"].includes(access.role)) return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });

  const { purchaseId } = await params;
  const body = await request.json().catch(() => null);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await registerManualSupplierPayment({
    organizationId,
    purchaseId,
    actorId: access.actorId,
    amount: body?.amount,
    paidAt: body?.paid_at,
    method: body?.method,
    reference: body?.reference,
    description: body?.description,
  });
  return NextResponse.json(result, { status: result.ok ? 201 : result.error === "purchase_not_found" ? 404 : 400 });
}
