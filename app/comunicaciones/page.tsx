import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { loadCommunicationCadenceSettings } from "@/lib/communication-settings-server";
import { loadCommunicationWorkspace, syncCommunicationFollowups } from "@/lib/communications-server";
import { hasPermission } from "@/lib/rbac";
import { CommunicationsWorkspace } from "./CommunicationsWorkspace";
import "./comunicaciones.css";

export default async function CommunicationsPage() {
  const session = await requireAppPermission("communications.view");
  const canManage = hasPermission(session.role, "communications.manage");
  const canManageTemplates = hasPermission(session.role, "communications.templates.manage");

  let syncError: string | null = null;
  if (canManage) {
    try {
      await syncCommunicationFollowups(session.organizationId);
    } catch (error) {
      syncError = error instanceof Error ? error.message : "communication_sync_failed";
    }
  }

  const [workspace, settings] = await Promise.all([
    loadCommunicationWorkspace(session.organizationId),
    loadCommunicationCadenceSettings(session.organizationId),
  ]);

  return <AppShell>
    <PageHeader
      eyebrow="Seguimiento operativo"
      title="Comunicaciones"
      description="Mensajes preparados, cadencias, historial de contacto y tareas de seguimiento para clientes y proveedores."
    />
    <CommunicationsWorkspace
      initialWorkspace={workspace}
      initialSettings={settings}
      canManage={canManage}
      canManageTemplates={canManageTemplates}
      generatedAt={new Date().toISOString()}
      initialSyncError={syncError}
    />
  </AppShell>;
}
