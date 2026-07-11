import { NextRequest, NextResponse } from "next/server";
import { requireInternalAccess, jsonAccessDenied } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { enqueuePurchaseHoldedSync } from "@/lib/expected-purchases-server";

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  const purchaseId = String(body?.purchaseId || "").trim();
  if (!purchaseId) return NextResponse.json({ ok: false, error: "purchase_id_required" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await enqueuePurchaseHoldedSync({ organizationId, purchaseId, actorId: access.actorId });
  return NextResponse.json(result, { status: result.ok ? 202 : 400 });
}
