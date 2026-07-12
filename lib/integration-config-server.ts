import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type ConfigurableWebhookIntegration = "fillout" | "booking";

export async function getWebhookIntegrationConfig(organizationId: string, integration: ConfigurableWebhookIntegration) {
  const enabledKey = integration === "fillout" ? "integrations.fillout.enabled" : "integrations.booking.enabled";
  const secretKey = integration === "fillout" ? "fillout_webhook_secret" : "booking_webhook_secret";
  const [{ data }, secret] = await Promise.all([
    getSupabaseAdminClient().from("routsify_settings").select("value").eq("organization_id", organizationId).eq("key", enabledKey).maybeSingle(),
    getOrganizationSecret(organizationId, secretKey),
  ]);
  return {
    enabled: data?.value === undefined || data?.value === null ? true : data.value !== false,
    secret,
  };
}
