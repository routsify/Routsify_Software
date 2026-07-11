import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationProposals } from "@/lib/organization-repositories";
import { BudgetManager } from "./BudgetManager";

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const session = await requireAppSession();
  const [{ caseId }, proposalResult, caseResult] = await Promise.all([
    searchParams,
    listOrganizationProposals(session.organizationId),
    listOrganizationCases(session.organizationId),
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
