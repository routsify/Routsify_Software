import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationProposals } from "@/lib/organization-repositories";
import Link from "next/link";
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
      <div className="page-actions"><Link className="btn secondary" href="/propuestas/pagos">Gestionar pagos Teya</Link></div>
      <BudgetManager initialProposals={proposals} initialCases={cases} initialCaseId={caseId || ""} />
    </AppShell>
  );
}
