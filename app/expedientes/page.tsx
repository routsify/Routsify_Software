import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listCasesRepository, listClientsRepository } from "@/lib/server-repositories";
import { CasesManager } from "./CasesManager";

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const [{ clientId }, caseResult, clientResult] = await Promise.all([
    searchParams,
    listCasesRepository(),
    listClientsRepository(),
  ]);
  const cases = caseResult.ok ? caseResult.data : [];
  const clients = clientResult.ok ? clientResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Expedientes"
        title="Centro operativo de expedientes"
        description="Gestiona cliente, destino, fechas, estado y próxima acción de cada viaje."
      />
      <CasesManager initialCases={cases} initialClients={clients} initialClientId={clientId || ""} />
    </AppShell>
  );
}
