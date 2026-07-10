import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listCasesRepository } from "@/lib/server-repositories";
import { CasesManager } from "./CasesManager";

export default async function CasesPage() {
  const result = await listCasesRepository();
  const cases = result.ok ? result.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Expedientes"
        title="Centro operativo de expedientes"
        description="Gestiona clientes, destino, fechas, estado y próxima acción de cada viaje."
      />
      <CasesManager initialCases={cases} />
    </AppShell>
  );
}
