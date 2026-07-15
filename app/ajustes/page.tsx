import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { listOrganizationSecretStatuses } from "@/lib/organization-secrets-server";
import { ProductionSettings } from "./ProductionSettings";

export default async function SettingsPage() {
  const session = await requireAppPermission("settings.view");
  const [{ data }, secretStatuses] = await Promise.all([
    getSupabaseAdminClient()
      .from("routsify_settings")
      .select("key,value,updated_at")
      .eq("organization_id", session.organizationId),
    listOrganizationSecretStatuses(session.organizationId).catch(() => []),
  ]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Ajustes"
        title="Ajustes del sistema"
        description="Configuración efectiva de empresa, márgenes, presupuestos, compras, fiscalidad e integraciones."
      />
      <ProductionSettings storedRows={(data || []) as Record<string, unknown>[]} secretStatuses={secretStatuses} canManageSecrets={session.role === "admin"} />
    </AppShell>
  );
}
