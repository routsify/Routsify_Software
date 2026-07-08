import { NextRequest, NextResponse } from "next/server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";

function demoOrganizationId() {
  return process.env.DEMO_ORGANIZATION_ID || "00000000-0000-0000-0000-000000000001";
}

function verifyWebhook(request: NextRequest) {
  const configured = process.env.FORM_WEBHOOK_SECRET;
  if (!configured) return true;
  return request.headers.get("x-routsify-signature") === configured;
}

export async function POST(request: NextRequest) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const result = await enqueueOutboxEvent({
    organizationId: demoOrganizationId(),
    channel: "form",
    eventType: "lead.created",
    payload: payload as Record<string, unknown>,
    risk: "low",
    businessRule: "Formulario externo entra primero como solicitud, nunca como expediente directo.",
    nextAction: "Cualificar solicitud y deduplicar cliente.",
    idempotencyKey: request.headers.get("x-idempotency-key") || undefined,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
