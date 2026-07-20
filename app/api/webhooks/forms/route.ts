import { NextRequest, NextResponse } from "next/server";
import { normalizeFilloutSubmission } from "@/lib/fillout-submission-server";
import { getWebhookIntegrationConfig } from "@/lib/integration-config-server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { providerIdempotencyKey, verifyStaticBearerRequest, verifyWebhookRequest } from "@/lib/webhook-security";

export const maxDuration = 60;

// normalizeFilloutSubmission preserves the native submissionId, questions and fillout_submission payload contract.
async function resolveWebhookOrganizationId() {
  return process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const organizationId = await resolveWebhookOrganizationId();
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 503 });
  const configuration = await getWebhookIntegrationConfig(organizationId, "fillout");
  if (!configuration.enabled) return NextResponse.json({ ok: false, error: "fillout_integration_disabled" }, { status: 503 });

  const eventId = request.headers.get("x-routsify-event-id") || request.headers.get("x-idempotency-key") || request.headers.get("x-fillout-submission-id");
  const hasHmacHeaders = Boolean(request.headers.get("x-routsify-signature") || request.headers.get("x-routsify-timestamp"));
  const verification = hasHmacHeaders
    ? verifyWebhookRequest({ rawBody, secret: configuration.secret || undefined, signature: request.headers.get("x-routsify-signature"), timestamp: request.headers.get("x-routsify-timestamp"), eventId })
    : verifyStaticBearerRequest({ secret: configuration.secret || undefined, authorization: request.headers.get("authorization"), eventId });
  if (!verification.ok) return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });

  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody || "null");
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? normalizeFilloutSubmission(parsed as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const result = await enqueueOutboxEvent({ organizationId, channel: "form", eventType: "lead.created", payload: { ...payload, verificationMode: verification.mode }, risk: "low", businessRule: "Formulario externo entra primero como solicitud, nunca como expediente directo.", nextAction: "Cualificar solicitud y deduplicar cliente.", idempotencyKey: providerIdempotencyKey({ channel: "form", eventType: "lead.created", payload, fallbackRawBody: rawBody, eventId: verification.eventId }) });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  const processing = await processOutboxBatch(25, organizationId);
  return NextResponse.json({ ...result, processing }, { status: 200 });
}
