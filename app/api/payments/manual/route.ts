import { NextRequest, NextResponse } from "next/server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { cases } from "@/lib/mock-data";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";

function paymentPreflight(input: { caseCode?: string; amount?: number; reference?: string }) {
  if (!input.caseCode || !/^EXP-[0-9]{4}-[0-9]{4}$/.test(input.caseCode)) return "invalid_case_code";
  if (!input.amount || input.amount <= 0) return "positive_amount_required";
  if (!input.reference || input.reference.trim().length < 4) return "payment_reference_required";
  const currentCase = cases.find((item) => item.case_code === input.caseCode);
  if (!currentCase) return "case_not_found";
  if (currentCase.accepted_value <= 0 && currentCase.status !== "proposal_accepted") return "proposal_not_accepted";
  return null;
}

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null) as { caseId?: string; caseCode?: string; amount?: number; reference?: string; receivedAt?: string } | null;
  const preflightError = paymentPreflight(body || {});
  if (preflightError || !body?.caseCode || !body.amount || !body.reference) {
    return NextResponse.json({ ok: false, error: preflightError || "caseCode_amount_reference_required" }, { status: 400 });
  }

  const result = await enqueueOutboxEvent({
    organizationId: access.organizationId,
    channel: "payment",
    eventType: "payment.manual_confirmed",
    relatedCaseId: body.caseId || null,
    payload: { caseCode: body.caseCode, amount: body.amount, reference: body.reference, receivedAt: body.receivedAt || new Date().toISOString(), preflight: "passed", actorId: access.actorId },
    risk: "medium",
    businessRule: "El pago manual exige propuesta aceptada, referencia unica y revision fiscal antes de desbloquear cierre.",
    nextAction: "Revisar fiscalidad manual_review y estado del expediente.",
    idempotencyKey: `payment:manual:${body.reference}`,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
