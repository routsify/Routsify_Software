import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationSecretStatuses } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { FilloutSettingsClient } from "./FilloutSettingsClient";

function rawValue(rows: Array<{ key: string; value: unknown }>, key: string) {
  const value = rows.find((row) => row.key === key)?.value;
  if (value && typeof value === "object" && "value" in value) return (value as { value?: unknown }).value;
  return value;
}

export default async function FilloutSettingsPage() {
  const session = await requireAppPermission("settings.view");
  const keys = [
    "integrations.fillout.enabled",
    "integrations.fillout.form_id",
    "integrations.fillout.public_url",
    "integrations.fillout.source_label",
  ];
  const [{ data }, statuses] = await Promise.all([
    getSupabaseAdminClient().from("routsify_settings").select("key,value").eq("organization_id", session.organizationId).in("key", keys),
    listOrganizationSecretStatuses(session.organizationId),
  ]);
  const rows = (data || []) as Array<{ key: string; value: unknown }>;
  const enabledValue = rawValue(rows, "integrations.fillout.enabled");

  return <AppShell>
    <PageHeader eyebrow="Ajustes · Integraciones" title="Conectar Fillout" description="Conexión mediante REST API para importar respuestas del formulario de solicitudes de viaje." />
    <FilloutSettingsClient
      canManage={session.role === "admin"}
      initialEnabled={enabledValue === true || enabledValue === "true"}
      initialFormId={String(rawValue(rows, "integrations.fillout.form_id") || "")}
      initialPublicUrl={String(rawValue(rows, "integrations.fillout.public_url") || "")}
      initialSourceLabel={String(rawValue(rows, "integrations.fillout.source_label") || "Fillout")}
      apiKeyConfigured={statuses.some((item) => item.key === "fillout_webhook_secret" && item.configured)}
    />
  </AppShell>;
}
