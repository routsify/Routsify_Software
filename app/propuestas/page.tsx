import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationCases } from "@/lib/organization-repositories";
import { PROPOSAL_WITH_VERSIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import Link from "next/link";
import { BudgetManager } from "./BudgetManager";

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ caseId?: string; clientId?: string }> }) {
  const session = await requireAppSession();
  const [{ caseId, clientId }, proposalQuery, caseResult] = await Promise.all([
    searchParams,
    getSupabaseAdminClient().from("proposals").select(PROPOSAL_WITH_VERSIONS_SELECT).eq("organization_id", session.organizationId).order("created_at", { ascending: false }).limit(100),
    listOrganizationCases(session.organizationId),
  ]);
  const proposals = proposalQuery.error ? [] : proposalQuery.data || [];
  const cases = caseResult.ok ? caseResult.data : [];
  const caseRows = cases as Array<{ id?: unknown; client_id?: unknown }>;
  const resolvedCaseId = caseId || (clientId ? String(caseRows.find((item) => String(item.client_id || "") === clientId)?.id || "") : "");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Presupuestos"
        title="Presupuestos"
        description="Crea un presupuesto por expediente, añade servicios y controla su estado."
      />
      <div className="page-actions"><Link className="btn secondary" href="/propuestas/pagos" prefetch={false}>Gestionar pagos Teya</Link></div>
      {proposalQuery.error ? <section className="card form-warning"><strong>No se pudieron cargar los presupuestos.</strong><p>{proposalQuery.error.message}</p></section> : null}
      <BudgetManager initialProposals={proposals} initialCases={cases} initialCaseId={resolvedCaseId} />
    </AppShell>
  );
}
