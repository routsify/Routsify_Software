import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listAutomationWorkspace } from "@/lib/automation-rules-server";
import { AutomationManager } from "./AutomationManager";

export default async function AutomationsPage() {
  const session = await requireAppPermission("settings.manage");
  const workspace = await listAutomationWorkspace(session.organizationId);
  return <AppShell>
    <PageHeader
      eyebrow="Automatizaciones"
      title="Reglas operativas de la agencia"
      description="Crea tareas automáticamente cuando un expediente lleva tiempo sin actividad o se aproxima la fecha del viaje. Cada ejecución es idempotente y queda auditada."
    />
    <AutomationManager initialRules={workspace.rules} initialExecutions={workspace.executions} users={workspace.users} />
  </AppShell>;
}
