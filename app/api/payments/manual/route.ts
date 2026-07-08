import { NextRequest, NextResponse } from "next/server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";

function demoOrganizationId() {
  return process.env.DEMO_ORGANIZATION_ID || "00000000-0000-0000-0000-000000000001";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { caseId?: string; caseCode?: string; amount?: number; reference?: string; receivedAt?: string } | null;
  if (!body?.caseCode || !body.amount || body.amount <= 0) {
    return NextResponse.json({ ok: false, error: "caseCode_and_positive_amount_required" }, { status: 400 });
  }

  const result = await enqueueOutboxEvent({
    organizationId: demoOrganizationId(),
    channel: "payment",
    eventType: "payment.manual_confirmed",
    relatedCaseId: body.caseId || null,
    payload: { caseCode: body.caseCode, amount: body.amount, reference: body.reference || null, receivedAt: body.receivedAt || new Date().toISOString() },
    risk: "medium",
    businessRule: "El pago se confirma manualmente antes de desbloquear documento fiscal o cierre.",
    nextAction: "Revisar facturación y estado del expediente.",
    idempotencyKey: body.reference || undefined,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
