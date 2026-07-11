import { NextRequest, NextResponse } from "next/server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { providerIdempotencyKey, verifyWebhookRequest } from "@/lib/webhook-security";

async function resolveWebhookOrganizationId() {
  if (process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID) return process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID;
  if (!hasSupabaseAdminEnv()) return "";
  const { data } = await getSupabaseAdminClient().from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return String(data?.id || "");
}

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

  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody || "null");
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    payload = null;
  }
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const organizationId = await resolveWebhookOrganizationId();
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 503 });

  const result = await enqueueOutboxEvent({
    organizationId,
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
