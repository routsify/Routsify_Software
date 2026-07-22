import { NextRequest, NextResponse } from "next/server";
import { requireInternalAccess, jsonAccessDenied } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { enqueuePurchaseHoldedSync, syncExpectedPurchasesFromHolded } from "@/lib/expected-purchases-server";

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  const purchaseId = String(body?.purchaseId || "").trim();
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = purchaseId
    ? await enqueuePurchaseHoldedSync({ organizationId, purchaseId, actorId: access.actorId })
    : await syncExpectedPurchasesFromHolded({ organizationId });
  return NextResponse.json(result, { status: result.ok ? 202 : 400 });
}
