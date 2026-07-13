import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationClientActivity, listOrganizationClients } from "@/lib/organization-repositories";
import { ClientOperationsOverview } from "./ClientOperationsOverview";
import { ClientsManager } from "./ClientsManager";

export default async function ClientsPage() {
  const session = await requireAppSession();
  const [clientResult, activityResult] = await Promise.all([
    listOrganizationClients(session.organizationId),
    listOrganizationClientActivity(session.organizationId),
  ]);
  const clients = clientResult.ok ? clientResult.data : [];
  const activity = activityResult.ok ? activityResult.data : { leads: [], bookings: [], tasks: [], cases: [], timeline: [], filloutUrl: "" };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
        description="Ficha única con contacto, solicitudes, llamadas, tareas y expedientes relacionados."
      />
      <ClientsManager initialClients={clients} />
      <ClientOperationsOverview
        initialClients={clients}
        initialLeads={activity.leads}
        initialBookings={activity.bookings}
        initialTasks={activity.tasks}
        initialCases={activity.cases}
        filloutUrl={activity.filloutUrl}
      />
    </AppShell>
  );
}
