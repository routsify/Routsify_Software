import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { ProductionSettings } from "./ProductionSettings";

export default async function SettingsPage() {
  const session = await requireAppSession();
  const { data } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value,updated_at")
    .eq("organization_id", session.organizationId);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Ajustes"
        title="Ajustes del sistema"
        description="Configuración efectiva de empresa, márgenes, presupuestos, compras, fiscalidad e integraciones."
      />
      <ProductionSettings storedRows={(data || []) as Record<string, unknown>[]} />
    </AppShell>
  );
}
