import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationClients } from "@/lib/organization-repositories";
import { ClientsManager } from "./ClientsManager";

export default async function ClientsPage() {
  const session = await requireAppSession();
  const result = await listOrganizationClients(session.organizationId);
  const clients = result.ok ? result.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
        description="Crea, consulta y mantiene fichas reales de clientes para trabajar con expedientes y presupuestos."
      />
      <ClientsManager initialClients={clients} />
    </AppShell>
  );
}
