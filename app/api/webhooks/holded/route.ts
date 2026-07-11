import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { providerIdempotencyKey, verifyWebhookRequest } from "@/lib/webhook-security";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verification = verifyWebhookRequest({ rawBody, secret: process.env.HOLDED_WEBHOOK_SECRET, signature: request.headers.get("x-routsify-signature"), timestamp: request.headers.get("x-routsify-timestamp"), eventId: request.headers.get("x-routsify-event-id") || request.headers.get("x-idempotency-key") });
  if (!verification.ok) return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });
  const payload = JSON.parse(rawBody || "null") as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const organizationId = process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 503 });
  const eventType = String(payload.event_type || payload.type || "holded.updated");
  const idempotencyKey = providerIdempotencyKey({ channel: "holded", eventType, payload, fallbackRawBody: rawBody, eventId: verification.eventId });
  const supabase = getSupabaseAdminClient();
  const { data: outboxId, error } = await supabase.rpc("enqueue_integration_event", { target_org: organizationId, channel_name: "holded", event_name: eventType, idem_key: idempotencyKey, event_payload: payload, event_risk: "high", rule: "Los cambios entrantes de Holded no sobrescriben estados operativos críticos.", action: "Revisar y conciliar manualmente." });
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, outbox_id: outboxId });
}
