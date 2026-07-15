import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationSuppliers } from "@/lib/organization-repositories";
import { PROPOSAL_WITH_VERSIONS_SELECT } from "@/lib/query-selects";
import { hasPermission } from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { BudgetManager } from "../../BudgetManager";
import { BudgetReadOnlyWorkspace } from "../../BudgetReadOnlyWorkspace";

export default async function ProposalWorkspacePage({ params }: { params: Promise<{ proposalId: string }> }) {
  const session = await requireAppPermission("budgets.view");
  const { proposalId } = await params;
  const canManage = hasPermission(session.role, "budgets.manage");
  const [proposalResult, caseResult, supplierResult] = await Promise.all([
    getSupabaseAdminClient()
      .from("proposals")
      .select(PROPOSAL_WITH_VERSIONS_SELECT)
      .eq("id", proposalId)
      .eq("organization_id", session.organizationId)
      .maybeSingle(),
    canManage ? listOrganizationCases(session.organizationId) : Promise.resolve({ ok: true as const, mode: "supabase" as const, data: [] }),
    canManage ? listOrganizationSuppliers(session.organizationId) : Promise.resolve({ ok: true as const, mode: "supabase" as const, data: [] }),
  ]);
  if (proposalResult.error || !proposalResult.data) notFound();
  const cases = caseResult.ok ? caseResult.data : [];
  const suppliers = supplierResult.ok ? supplierResult.data : [];
  const rawCase = Array.isArray(proposalResult.data.cases) ? proposalResult.data.cases[0] : proposalResult.data.cases;
  const caseId = String(rawCase?.id || "");
  const caseCode = String(rawCase?.case_code || "Presupuesto");
  const client = Array.isArray(rawCase?.clients) ? rawCase.clients[0] : rawCase?.clients;

  return <AppShell>
    <PageHeader
      eyebrow="Presupuesto"
      title={caseCode}
      description={`${String(client?.display_name || "Cliente")} · ${String(rawCase?.destination || "Destino pendiente")}`}
      action={<Link className="btn secondary" href="/propuestas" prefetch={false}>Volver a presupuestos</Link>}
    />
    {canManage
      ? <BudgetManager initialProposals={[proposalResult.data]} initialCases={cases} initialSuppliers={suppliers} initialCaseId={caseId} />
      : <BudgetReadOnlyWorkspace proposalInput={proposalResult.data} />}
  </AppShell>;
}
