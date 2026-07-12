import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const organizationSecretKeys = ["holded_api_key", "openai_api_key"] as const;
export type OrganizationSecretKey = (typeof organizationSecretKeys)[number];

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
  return organizationSecretKeys.map((key) => ({ key, configured: rows.has(key), updatedAt: rows.get(key) || null }));
}

export async function getOrganizationSecret(organizationId: string, secretKey: OrganizationSecretKey): Promise<string | null> {
  const { data, error } = await getSupabaseAdminClient().rpc("get_organization_secret", {
    target_org: organizationId,
    target_key: secretKey,
  });
  if (error) {
    // Backwards-compatible server-only fallback while a project is finishing the Vault migration.
    if (secretKey === "holded_api_key") return process.env.HOLDED_API_KEY || null;
    if (secretKey === "openai_api_key") return process.env.OPENAI_API_KEY || null;
    throw new Error(error.message);
  }
  const value = typeof data === "string" ? data.trim() : "";
  if (value) return value;
  if (secretKey === "holded_api_key") return process.env.HOLDED_API_KEY || null;
  if (secretKey === "openai_api_key") return process.env.OPENAI_API_KEY || null;
  return null;
}

export async function setOrganizationSecret(input: {
  organizationId: string;
  secretKey: OrganizationSecretKey;
  value: string;
  actorId: string;
}) {
  const value = input.value.trim();
  if (value.length < 12 || value.length > 4096) throw new Error("invalid_secret_length");
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
