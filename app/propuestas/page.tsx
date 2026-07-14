import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationCases } from "@/lib/organization-repositories";
import { PROPOSAL_INDEX_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { ProposalIndexManager } from "./ProposalIndexManager";

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ caseId?: string; clientId?: string }> }) {
  const session = await requireAppSession();
  const [{ caseId, clientId }, proposalQuery, caseResult] = await Promise.all([
    searchParams,
    getSupabaseAdminClient().from("proposals").select(PROPOSAL_INDEX_SELECT).eq("organization_id", session.organizationId).order("created_at", { ascending: false }).limit(100),
    listOrganizationCases(session.organizationId),
  ]);
  const proposals = proposalQuery.error ? [] : proposalQuery.data || [];
  const cases = caseResult.ok ? caseResult.data : [];
  const caseRows = cases as Array<{ id?: unknown; client_id?: unknown }>;
  const resolvedCaseId = caseId || (clientId ? String(caseRows.find((item) => String(item.client_id || "") === clientId)?.id || "") : "");
  const existing = resolvedCaseId ? (proposals as Array<{ id?: unknown; cases?: { id?: unknown } | Array<{ id?: unknown }> | null }>).find((proposal) => {
    const caseRow = Array.isArray(proposal.cases) ? proposal.cases[0] : proposal.cases;
    return String(caseRow?.id || "") === resolvedCaseId;
  }) : null;
  if (existing?.id) redirect(`/propuestas/editar/${encodeURIComponent(String(existing.id))}`);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Presupuestos"
        title="Presupuestos"
        description="Consulta el listado ligero y abre únicamente el presupuesto que necesitas editar."
      />
      <div className="page-actions"><Link className="btn secondary" href="/propuestas/pagos" prefetch={false}>Gestionar pagos Teya</Link></div>
      {proposalQuery.error ? <section className="card form-warning"><strong>No se pudieron cargar los presupuestos.</strong><p>{proposalQuery.error.message}</p></section> : null}
      <ProposalIndexManager initialProposals={proposals} initialCases={cases} initialCaseId={resolvedCaseId} />
    </AppShell>
  );
}
