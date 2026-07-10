import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listCasesRepository, listProposalsRepository } from "@/lib/server-repositories";
import { BudgetManager } from "./BudgetManager";

export default async function ProposalsPage() {
  const [proposalResult, caseResult] = await Promise.all([listProposalsRepository(), listCasesRepository()]);
  const proposals = proposalResult.ok ? proposalResult.data : [];
  const cases = caseResult.ok ? caseResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Presupuestos"
        title="Presupuestos"
        description="Crea presupuestos por expediente, añade líneas, calcula venta y cambia el estado de forma controlada."
      />
      <BudgetManager initialProposals={proposals} initialCases={cases} />
    </AppShell>
  );
}
