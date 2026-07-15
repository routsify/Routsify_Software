import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { CASE_SUMMARY_PROPOSALS_SELECT } from "@/lib/query-selects";
import { hasPermission } from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { CaseWorkspace } from "./CaseWorkspace";
import "./contract.css";

const CASE_DETAIL_SELECT = "id,organization_id,client_id,lead_id,case_code,title,status,destination,trip_start,trip_end,next_action,blocker,accepted_value,currency,created_at,updated_at,clients(id,display_name,email,phone,tax_id,billing_address)" as const;

export default async function CaseDetailPage({ params }: { params: Promise<{ caseCode: string }> }) {
  const session = await requireAppPermission("cases.view");
  const { caseCode } = await params;
  const supabase = getSupabaseAdminClient();
  const decoded = decodeURIComponent(caseCode);
  let caseQuery = supabase.from("cases").select(CASE_DETAIL_SELECT).eq("organization_id", session.organizationId);
  caseQuery = /^[0-9a-f-]{36}$/i.test(decoded) ? caseQuery.eq("id", decoded) : caseQuery.eq("case_code", decoded);
  const { data: caseRow, error: caseError } = await caseQuery.maybeSingle();
  if (caseError || !caseRow) notFound();

  const canViewPayments = hasPermission(session.role, "payments.manage");
  const canViewPurchases = hasPermission(session.role, "purchases.view");
  const emptyResult = Promise.resolve({ data: [], error: null });

  const [paymentsResult, purchasesResult, proposalsResult] = await Promise.all([
    canViewPayments
      ? supabase.from("payments").select("id,amount,currency,status,confirmed_at").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false })
      : emptyResult,
    canViewPurchases
      ? supabase.from("expected_purchases").select("id,supplier_name,service,expected_amount,amount,status").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false })
      : emptyResult,
    supabase.from("proposals").select(CASE_SUMMARY_PROPOSALS_SELECT).eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
  ]);
  const firstError = paymentsResult.error || purchasesResult.error || proposalsResult.error;
  if (firstError) throw new Error(firstError.message);

  const client = Array.isArray(caseRow.clients) ? caseRow.clients[0] : caseRow.clients;

  return <AppShell>
    <PageHeader eyebrow="Expediente" title={String(caseRow.case_code)} description={`${String(client?.display_name || "Cliente")} · ${String(caseRow.destination || "Destino pendiente")}`} action={<a className="btn secondary" href="/expedientes">Volver</a>} />
    <CaseWorkspace
      role={session.role}
      initialCase={{ ...caseRow, clients: client || null }}
      initialPayments={paymentsResult.data || []}
      initialPurchases={purchasesResult.data || []}
      initialProposals={proposalsResult.data || []}
    />
  </AppShell>;
}
