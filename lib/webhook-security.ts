import { createHmac, timingSafeEqual } from "crypto";

export type WebhookVerification =
  | { ok: true; mode: "hmac" | "bearer"; timestamp?: string; eventId?: string }
  | { ok: false; status: number; error: string };

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeSignature(value: string) {
  if (value.startsWith("sha256=")) return value.slice("sha256=".length);
  if (value.startsWith("sha256:")) return value.slice("sha256:".length);
  return value;
}

export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function verifyWebhookRequest(input: { rawBody: string; secret?: string; signature?: string | null; timestamp?: string | null; eventId?: string | null; toleranceSeconds?: number }): WebhookVerification {
  if (!input.secret) return { ok: false, status: 503, error: "webhook_secret_required" };
  if (!input.signature || !input.timestamp) return { ok: false, status: 401, error: "missing_signature_or_timestamp" };
  const timestampMs = Number(input.timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return { ok: false, status: 401, error: "invalid_timestamp" };
  const tolerance = (input.toleranceSeconds || 300) * 1000;
  if (Math.abs(Date.now() - timestampMs) > tolerance) return { ok: false, status: 401, error: "timestamp_out_of_tolerance" };

  const signedPayload = `${input.timestamp}.${input.rawBody}`;
  const expected = createHmac("sha256", input.secret).update(signedPayload).digest("hex");
  const received = normalizeSignature(input.signature);
  if (!safeEqual(received, expected)) return { ok: false, status: 401, error: "invalid_signature" };
  return { ok: true, mode: "hmac", timestamp: input.timestamp, eventId: input.eventId || undefined };
}

export function verifyStaticBearerRequest(input: { secret?: string; authorization?: string | null; eventId?: string | null }): WebhookVerification {
  if (!input.secret) return { ok: false, status: 503, error: "webhook_secret_required" };
  const authorization = String(input.authorization || "");
  const received = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!received || !safeEqual(received, input.secret)) return { ok: false, status: 401, error: "invalid_bearer_token" };
  return { ok: true, mode: "bearer", eventId: input.eventId || undefined };
}

export function providerIdempotencyKey(input: { channel: string; eventType: string; payload: Record<string, unknown>; fallbackRawBody: string; eventId?: string | null }) {
  const sourceId = input.eventId || input.payload.submission_id || input.payload.submissionId || input.payload.external_booking_id || input.payload.externalBookingId || input.payload.booking_id || input.payload.id || input.payload.event_id || input.payload.reference;
  if (sourceId) return `${input.channel}:${input.eventType}:${String(sourceId)}`;
  return `${input.channel}:${input.eventType}:${createHmac("sha256", "routsify-idempotency").update(canonicalJsonStringify(input.payload) || input.fallbackRawBody).digest("hex")}`;
}
