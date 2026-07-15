import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationClients } from "@/lib/organization-repositories";
import { ClientsManager } from "./ClientsManager";

export default async function ClientsPage() {
  const session = await requireAppSession();
  const clientResult = await listOrganizationClients(session.organizationId);
  const clients = clientResult.ok ? clientResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
        description="Listado ligero de clientes. Abre la ficha 360 para consultar seguimiento, expedientes, presupuestos, pagos y actividad."
      />
      {clientResult.ok ? null : <section className="card form-warning"><strong>No se pudieron cargar los clientes.</strong><p>{clientResult.error}</p></section>}
      <ClientsManager initialClients={clients} />
    </AppShell>
  );
}
