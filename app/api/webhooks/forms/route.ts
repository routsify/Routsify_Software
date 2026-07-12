import { NextRequest, NextResponse } from "next/server";
import { getWebhookIntegrationConfig } from "@/lib/integration-config-server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { providerIdempotencyKey, verifyWebhookRequest } from "@/lib/webhook-security";

async function resolveWebhookOrganizationId() {
  return process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const organizationId = await resolveWebhookOrganizationId();
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 503 });

  const configuration = await getWebhookIntegrationConfig(organizationId, "fillout");
  if (!configuration.enabled) return NextResponse.json({ ok: false, error: "fillout_integration_disabled" }, { status: 503 });

  const verification = verifyWebhookRequest({
    rawBody,
    secret: configuration.secret || undefined,
    signature: request.headers.get("x-routsify-signature"),
    timestamp: request.headers.get("x-routsify-timestamp"),
    eventId: request.headers.get("x-routsify-event-id") || request.headers.get("x-idempotency-key"),
  });

  if (!verification.ok) return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });

  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody || "null");
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  const result = await enqueueOutboxEvent({
    organizationId,
    channel: "form",
    eventType: "lead.created",
    payload: { ...payload, verificationMode: verification.mode },
    risk: "low",
    businessRule: "Formulario externo entra primero como solicitud, nunca como expediente directo.",
    nextAction: "Cualificar solicitud y deduplicar cliente.",
    idempotencyKey: providerIdempotencyKey({ channel: "form", eventType: "lead.created", payload, fallbackRawBody: rawBody, eventId: verification.eventId }),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
