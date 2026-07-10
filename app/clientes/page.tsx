import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listClientsRepository } from "@/lib/server-repositories";
import { ClientsManager } from "./ClientsManager";

export default async function ClientsPage() {
  const result = await listClientsRepository();
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
