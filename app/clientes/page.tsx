import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationClientsPage } from "@/lib/organization-repositories";
import { ClientsManager } from "./ClientsManager";

export default async function ClientsPage() {
  const session = await requireAppPermission("clients.view");
  const clientResult = await listOrganizationClientsPage(session.organizationId, { page: 1, pageSize: 50 });
  const initialPage = clientResult.ok ? clientResult.data : {
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    query: "",
    stats: { total: 0, withEmail: 0, withPhone: 0, fiscalComplete: 0 },
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
        description="Consulta, busca, importa y administra clientes mediante un listado paginado. Abre la ficha 360 para revisar seguimiento, expedientes, presupuestos, pagos y actividad."
      />
      {clientResult.ok ? null : <section className="card form-warning"><strong>No se pudieron cargar los clientes.</strong><p>{clientResult.error}</p></section>}
      <ClientsManager initialPage={initialPage} />
    </AppShell>
  );
}
