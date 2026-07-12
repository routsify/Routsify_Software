import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { confirmManualPaymentLink } from "@/lib/payment-workflow-server";
import { resolveOrganizationId } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ paymentLinkId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { paymentLinkId } = await params;
  const body = await request.json().catch(() => null);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    const data = await confirmManualPaymentLink({ organizationId, paymentLinkId, reference: String(body?.reference || ""), amount: Number(body?.amount || 0) || undefined, receivedAt: body?.received_at ? String(body.received_at) : undefined, actorId: access.actorId, notes: body?.notes ? String(body.notes) : null });
    return NextResponse.json({ ok: true, data }, { status: data.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment_confirmation_failed";
    return NextResponse.json({ ok: false, error: message }, { status: message === "payment_link_not_found" ? 404 : 400 });
  }
}
