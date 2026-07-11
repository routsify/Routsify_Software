import { NextRequest, NextResponse } from "next/server";
import { requireInternalAccess, jsonAccessDenied } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { transitionExpectedPurchase } from "@/lib/expected-purchases-server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { purchaseId } = await params;
  const body = await request.json().catch(() => null);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await transitionExpectedPurchase({ organizationId, purchaseId, status: "not_required", actorId: access.actorId, reason: typeof body?.reason === "string" ? body.reason : null });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
