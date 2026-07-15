import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationClients } from "@/lib/organization-repositories";
import { hasPermission } from "@/lib/rbac";
import { CasesManager } from "./CasesManager";
import { CasesReadOnlyTable } from "./CasesReadOnlyTable";

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ clientId?: string; caseId?: string }> }) {
  const session = await requireAppPermission("cases.view");
  const canManage = hasPermission(session.role, "cases.manage");
  const [{ clientId, caseId }, caseResult, clientResult] = await Promise.all([
    searchParams,
    listOrganizationCases(session.organizationId),
    canManage ? listOrganizationClients(session.organizationId) : Promise.resolve({ ok: true as const, mode: "supabase" as const, data: [] }),
  ]);
  const rawCases = caseResult.ok ? caseResult.data : [];
  const cases = caseId
    ? [...rawCases].sort((left, right) => Number(String((right as { id?: unknown }).id || "") === caseId) - Number(String((left as { id?: unknown }).id || "") === caseId))
    : rawCases;
  const clients = clientResult.ok ? clientResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Expedientes"
        title="Centro operativo de expedientes"
        description={canManage ? "Gestiona cliente, destino, fechas, estado y próxima acción de cada viaje." : "Consulta el estado, fechas, valor y próxima acción de cada viaje."}
      />
      {canManage
        ? <CasesManager initialCases={cases} initialClients={clients} initialClientId={clientId || ""} />
        : <CasesReadOnlyTable initialCases={cases} />}
    </AppShell>
  );
}
