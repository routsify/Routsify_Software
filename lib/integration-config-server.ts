import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";

export type ConfigurableWebhookIntegration = "fillout" | "booking";

export async function getWebhookIntegrationConfig(organizationId: string, integration: ConfigurableWebhookIntegration) {
  const enabledKey = integration === "fillout" ? "integrations.fillout.enabled" : "integrations.booking.enabled";
  const secretKey = integration === "fillout" ? "fillout_webhook_secret" : "booking_webhook_secret";
  const [settings, secret] = await Promise.all([
    loadEffectiveSettings(organizationId),
    getOrganizationSecret(organizationId, secretKey),
  ]);
  return {
    enabled: settings.boolean(enabledKey, true),
    secret,
  };
}
