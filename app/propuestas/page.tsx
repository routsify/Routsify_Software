import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listCasesRepository, listProposalsRepository } from "@/lib/server-repositories";
import { BudgetManager } from "./BudgetManager";

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const [{ caseId }, proposalResult, caseResult] = await Promise.all([
    searchParams,
    listProposalsRepository(),
    listCasesRepository(),
  ]);
  const proposals = proposalResult.ok ? proposalResult.data : [];
  const cases = caseResult.ok ? caseResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Presupuestos"
        title="Presupuestos"
        description="Crea un presupuesto por expediente, añade servicios y controla su estado."
      />
      <BudgetManager initialProposals={proposals} initialCases={cases} initialCaseId={caseId || ""} />
    </AppShell>
  );
}
