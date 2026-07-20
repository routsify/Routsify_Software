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
import { ProposalScenariosPanel } from "./ProposalScenariosPanel";
import "./proposal-scenarios.css";

type VersionRow = { id?: unknown; version_number?: unknown; status?: unknown; locked?: unknown };

export default async function ProposalWorkspacePage({ params }: { params: Promise<{ proposalId: string }> }) {
  const session = await requireAppPermission("budgets.view");
  const { proposalId } = await params;
  const canManage = hasPermission(session.role, "budgets.manage");
  const db = getSupabaseAdminClient();
  const [proposalResult, caseResult, supplierResult, scenarioResult] = await Promise.all([
    db.from("proposals").select(PROPOSAL_WITH_VERSIONS_SELECT).eq("id", proposalId).eq("organization_id", session.organizationId).maybeSingle(),
    canManage ? listOrganizationCases(session.organizationId) : Promise.resolve({ ok: true as const, mode: "supabase" as const, data: [] }),
    canManage ? listOrganizationSuppliers(session.organizationId) : Promise.resolve({ ok: true as const, mode: "supabase" as const, data: [] }),
    db.from("proposal_scenarios").select("id,proposal_id,source_version_id,name,scenario_type,description,target_margin_pct,total_cost,total_sale,profit,margin_pct,status,applied_at,created_at,updated_at").eq("organization_id", session.organizationId).eq("proposal_id", proposalId).neq("status", "archived").order("created_at", { ascending: false }),
  ]);
  if (proposalResult.error || !proposalResult.data) notFound();
  const cases = caseResult.ok ? caseResult.data : [];
  const suppliers = supplierResult.ok ? supplierResult.data : [];
  const rawCase = Array.isArray(proposalResult.data.cases) ? proposalResult.data.cases[0] : proposalResult.data.cases;
  const caseId = String(rawCase?.id || "");
  const caseCode = String(rawCase?.case_code || "Presupuesto");
  const currency = String(rawCase?.currency || "EUR");
  const client = Array.isArray(rawCase?.clients) ? rawCase.clients[0] : rawCase?.clients;
  const versions = Array.isArray(proposalResult.data.proposal_versions) ? proposalResult.data.proposal_versions as VersionRow[] : [];
  const currentVersionId = String(proposalResult.data.current_version_id || "");
  const currentVersion = versions.find((version) => String(version.id || "") === currentVersionId) || [...versions].sort((left, right) => Number(right.version_number || 0) - Number(left.version_number || 0))[0] || null;
  const sourceVersionId = String(currentVersion?.id || "");
  const currentEditable = Boolean(currentVersion && currentVersion.locked !== true && ["draft", "internal_review"].includes(String(currentVersion.status || "draft")));
  const scenarios = scenarioResult.error ? [] : scenarioResult.data || [];

  return <AppShell>
    <PageHeader
      eyebrow="Presupuesto"
      title={caseCode}
      description={`${String(client?.display_name || "Cliente")} · ${String(rawCase?.destination || "Destino pendiente")}`}
      action={<Link className="btn secondary" href="/propuestas" prefetch={false}>Volver a presupuestos</Link>}
    />
    {sourceVersionId ? <ProposalScenariosPanel proposalId={proposalId} sourceVersionId={sourceVersionId} currency={currency} initialScenarios={scenarios} currentEditable={currentEditable} /> : null}
    {canManage
      ? <BudgetManager initialProposals={[proposalResult.data]} initialCases={cases} initialSuppliers={suppliers} initialCaseId={caseId} />
      : <BudgetReadOnlyWorkspace proposalInput={proposalResult.data} />}
  </AppShell>;
}
