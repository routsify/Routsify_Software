import { createHmac, timingSafeEqual } from "node:crypto";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { loadThirdPartyIntegrationConfig } from "@/lib/third-party-integration-config-server";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function whatsappConfiguration(organizationId: string) {
  const config = await loadThirdPartyIntegrationConfig(organizationId);
  const [accessToken, verifyToken, appSecret] = await Promise.all([
    getOrganizationSecret(organizationId, "whatsapp_access_token"),
    getOrganizationSecret(organizationId, "whatsapp_verify_token"),
    getOrganizationSecret(organizationId, "whatsapp_app_secret"),
  ]);
  return { ...config.whatsapp, accessToken, verifyToken, appSecret };
}

export async function testWhatsAppConnection(organizationId: string) {
  const config = await whatsappConfiguration(organizationId);
  if (!config.enabled) return { ok: false as const, status: 503, error: "whatsapp_integration_disabled" };
  if (!config.accessToken || !config.phoneNumberId) return { ok: false as const, status: 503, error: "whatsapp_credentials_not_configured" };
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) return { ok: false as const, status: response.status, error: `whatsapp_http_${response.status}`, payload };
  return { ok: true as const, status: response.status, phoneNumberId: config.phoneNumberId, payload };
}

export async function sendWhatsAppText(input: { organizationId: string; to: string; body: string }) {
  const config = await whatsappConfiguration(input.organizationId);
  if (!config.enabled) return { ok: false as const, status: 503, error: "whatsapp_integration_disabled" };
  if (!config.accessToken || !config.phoneNumberId) return { ok: false as const, status: 503, error: "whatsapp_credentials_not_configured" };
  const to = normalizePhone(input.to);
  if (!to) return { ok: false as const, status: 400, error: "invalid_whatsapp_recipient" };
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: input.body.slice(0, 4096) },
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { messages?: Array<{ id?: string }>; error?: unknown } | null;
  if (!response.ok) return { ok: false as const, status: response.status, error: `whatsapp_http_${response.status}`, payload };
  const messageId = String(payload?.messages?.[0]?.id || "");
  if (!messageId) return { ok: false as const, status: 502, error: "whatsapp_message_id_missing", payload };
  return { ok: true as const, status: response.status, provider: "meta_whatsapp_cloud", messageId, payload };
}

export function verifyWhatsAppWebhookSignature(rawBody: string, signature: string | null, appSecret: string | null) {
  if (!appSecret) return { ok: false as const, status: 503, error: "whatsapp_app_secret_not_configured" };
  if (!signature?.startsWith("sha256=")) return { ok: false as const, status: 401, error: "missing_whatsapp_signature" };
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  if (!safeEqual(signature, expected)) return { ok: false as const, status: 401, error: "invalid_whatsapp_signature" };
  return { ok: true as const };
}
