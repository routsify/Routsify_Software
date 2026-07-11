import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { providerIdempotencyKey, verifyWebhookRequest } from "@/lib/webhook-security";

function numeric(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verification = verifyWebhookRequest({
    rawBody,
    secret: process.env.PAYMENT_WEBHOOK_SECRET,
    signature: request.headers.get("x-routsify-signature"),
    timestamp: request.headers.get("x-routsify-timestamp"),
    eventId: request.headers.get("x-routsify-event-id") || request.headers.get("x-idempotency-key"),
  });
  if (!verification.ok) return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const payload = JSON.parse(rawBody || "null") as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const organizationId = process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 503 });
  const caseId = String(payload.case_id || payload.caseId || "").trim();
  const transactionId = String(payload.transaction_id || payload.transactionId || payload.id || "").trim();
  const reference = String(payload.payment_reference || payload.reference || transactionId).trim();
  const amount = numeric(payload.amount);
  if (!caseId || !reference || amount <= 0) return NextResponse.json({ ok: false, error: "case_amount_reference_required" }, { status: 400 });

  const eventType = String(payload.event_type || "payment.confirmed");
  const idempotencyKey = providerIdempotencyKey({ channel: "payment", eventType, payload, fallbackRawBody: rawBody, eventId: verification.eventId });
  const supabase = getSupabaseAdminClient();
  const { data: existing } = await supabase.from("webhook_events").select("id,status").eq("organization_id", organizationId).eq("channel", "payment").eq("event_type", eventType).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing?.status === "processed") return NextResponse.json({ ok: true, idempotent: true });
  await supabase.from("webhook_events").upsert({ organization_id: organizationId, channel: "payment", event_type: eventType, idempotency_key: idempotencyKey, payload, status: "received" }, { onConflict: "organization_id,channel,event_type,idempotency_key" });

  const confirmedAt = payload.confirmed_at ? new Date(String(payload.confirmed_at)).toISOString() : new Date().toISOString();
  const { data, error } = await supabase.rpc("confirm_external_payment", {
    target_org: organizationId,
    target_case: caseId,
    transaction_value: transactionId || reference,
    payment_reference_value: reference,
    amount_value: amount,
    currency_value: String(payload.currency || "EUR"),
    provider_value: String(payload.provider || "payment_webhook"),
    confirmed_timestamp: confirmedAt,
    payment_payload: payload,
  });
  await supabase.from("webhook_events").update({ status: error ? "error" : "processed", processed_at: new Date().toISOString(), error_message: error?.message || null }).eq("organization_id", organizationId).eq("channel", "payment").eq("event_type", eventType).eq("idempotency_key", idempotencyKey);
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data });
}
