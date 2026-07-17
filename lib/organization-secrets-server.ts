import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const organizationSecretKeys = [
  "holded_api_key",
  "openai_api_key",
  "fillout_webhook_secret",
  "booking_webhook_secret",
  "smtp_username",
  "smtp_password",
  "whatsapp_access_token",
  "whatsapp_verify_token",
  "whatsapp_app_secret",
] as const;
export type OrganizationSecretKey = (typeof organizationSecretKeys)[number];

function environmentFallback(secretKey: OrganizationSecretKey) {
  if (secretKey === "holded_api_key") return process.env.HOLDED_API_KEY || null;
  if (secretKey === "openai_api_key") return process.env.OPENAI_API_KEY || null;
  if (secretKey === "fillout_webhook_secret") return process.env.FORM_WEBHOOK_SECRET || null;
  if (secretKey === "booking_webhook_secret") return process.env.BOOKING_WEBHOOK_SECRET || null;
  if (secretKey === "smtp_username") return process.env.SMTP_USERNAME || null;
  if (secretKey === "smtp_password") return process.env.SMTP_PASSWORD || null;
  if (secretKey === "whatsapp_access_token") return process.env.WHATSAPP_ACCESS_TOKEN || null;
  if (secretKey === "whatsapp_verify_token") return process.env.WHATSAPP_VERIFY_TOKEN || null;
  if (secretKey === "whatsapp_app_secret") return process.env.WHATSAPP_APP_SECRET || null;
  return null;
}

export function isOrganizationSecretKey(value: string): value is OrganizationSecretKey {
  return (organizationSecretKeys as readonly string[]).includes(value);
}

export type SecretStatus = {
  key: OrganizationSecretKey;
  configured: boolean;
  updatedAt: string | null;
};

export async function listOrganizationSecretStatuses(organizationId: string): Promise<SecretStatus[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("organization_secrets")
    .select("secret_key,updated_at")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  const rows = new Map((data || []).map((row) => [String(row.secret_key), String(row.updated_at || "")]));
  return organizationSecretKeys.map((key) => ({ key, configured: rows.has(key) || Boolean(environmentFallback(key)), updatedAt: rows.get(key) || null }));
}

export async function getOrganizationSecret(organizationId: string, secretKey: OrganizationSecretKey): Promise<string | null> {
  const { data, error } = await getSupabaseAdminClient().rpc("get_organization_secret", {
    target_org: organizationId,
    target_key: secretKey,
  });
  if (error) return environmentFallback(secretKey);
  const value = typeof data === "string" ? data.trim() : "";
  return value || environmentFallback(secretKey);
}

export async function setOrganizationSecret(input: {
  organizationId: string;
  secretKey: OrganizationSecretKey;
  value: string;
  actorId: string;
}) {
  const value = input.value.trim();
  if (value.length < 8 || value.length > 4096) throw new Error("invalid_secret_length");
  const { data, error } = await getSupabaseAdminClient().rpc("set_organization_secret", {
    target_org: input.organizationId,
    target_key: input.secretKey,
    secret_value: value,
    actor: input.actorId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteOrganizationSecret(input: {
  organizationId: string;
  secretKey: OrganizationSecretKey;
  actorId: string;
}) {
  const { data, error } = await getSupabaseAdminClient().rpc("delete_organization_secret", {
    target_org: input.organizationId,
    target_key: input.secretKey,
    actor: input.actorId,
  });
  if (error) throw new Error(error.message);
  return data;
}
