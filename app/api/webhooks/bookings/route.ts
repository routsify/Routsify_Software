import { NextRequest, NextResponse } from "next/server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { demoOrganizationId } from "@/lib/runtime-mode";
import { providerIdempotencyKey, verifyWebhookRequest } from "@/lib/webhook-security";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verification = verifyWebhookRequest({
    rawBody,
    secret: process.env.BOOKING_WEBHOOK_SECRET,
    signature: request.headers.get("x-routsify-signature"),
    timestamp: request.headers.get("x-routsify-timestamp"),
    eventId: request.headers.get("x-routsify-event-id") || request.headers.get("x-idempotency-key"),
  });

  if (!verification.ok) {
    return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });
  }

  const payload = JSON.parse(rawBody || "null") as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const result = await enqueueOutboxEvent({
    organizationId: demoOrganizationId(),
    channel: "booking",
    eventType: "booking.requested",
    payload: { ...payload, verificationMode: verification.mode },
    risk: "medium",
    businessRule: "Booking API entra como solicitud hasta validar encaje comercial y disponibilidad.",
    nextAction: "Revisar disponibilidad, presupuesto y contacto antes de convertir.",
    idempotencyKey: providerIdempotencyKey({ channel: "booking", eventType: "booking.requested", payload, fallbackRawBody: rawBody, eventId: verification.eventId }),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
