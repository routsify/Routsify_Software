import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { listOrganizationSecretStatuses } from "@/lib/organization-secrets-server";
import type { LegalDocumentRow } from "./LegalDocumentsPanel";
import { ProductionSettings } from "./ProductionSettings";

type SettingsTab = "general" | "appearance" | "users" | "legal" | "integrations" | "ai" | "operations" | "security";
const validTabs = new Set<SettingsTab>(["general", "appearance", "users", "legal", "integrations", "ai", "operations", "security"]);

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireAppPermission("settings.view");
  const params = await searchParams;
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab: SettingsTab = requestedTab && validTabs.has(requestedTab as SettingsTab) ? requestedTab as SettingsTab : "general";
  const supabase = getSupabaseAdminClient();
  const [{ data }, secretStatuses, legalDocumentsResult] = await Promise.all([
    supabase
      .from("routsify_settings")
      .select("key,value,updated_at")
      .eq("organization_id", session.organizationId),
    listOrganizationSecretStatuses(session.organizationId).catch(() => []),
    supabase
      .from("legal_documents")
      .select("id,document_type,title,version_label,file_name,status,is_active,is_test,size_bytes,created_at,activated_at,archived_at")
      .eq("organization_id", session.organizationId)
      .eq("is_test", false)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Ajustes"
        title="Ajustes del sistema"
        description="Configuración efectiva de empresa, márgenes, presupuestos, compras, fiscalidad e integraciones."
      />
      <ProductionSettings storedRows={(data || []) as Record<string, unknown>[]} secretStatuses={secretStatuses} legalDocuments={(legalDocumentsResult.data || []) as LegalDocumentRow[]} canManageSecrets={session.role === "admin"} initialTab={initialTab} />
    </AppShell>
  );
}
