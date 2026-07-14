import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { CASE_SUMMARY_PROPOSALS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { CaseWorkspace } from "./CaseWorkspace";
import "./contract.css";

export default async function CaseDetailPage({ params }: { params: Promise<{ caseCode: string }> }) {
  const session = await requireAppSession();
  const { caseCode } = await params;
  const supabase = getSupabaseAdminClient();
  const decoded = decodeURIComponent(caseCode);
  let caseQuery = supabase.from("cases").select("*,clients(id,display_name,email,phone,tax_id,billing_address)").eq("organization_id", session.organizationId);
  caseQuery = /^[0-9a-f-]{36}$/i.test(decoded) ? caseQuery.eq("id", decoded) : caseQuery.eq("case_code", decoded);
  const { data: caseRow, error: caseError } = await caseQuery.maybeSingle();
  if (caseError || !caseRow) notFound();

  const [paymentsResult, purchasesResult, proposalsResult] = await Promise.all([
    supabase.from("payments").select("id,amount,currency,status,confirmed_at").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
    supabase.from("expected_purchases").select("id,supplier_name,service,expected_amount,amount,status").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
    supabase.from("proposals").select(CASE_SUMMARY_PROPOSALS_SELECT).eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
  ]);
  const firstError = paymentsResult.error || purchasesResult.error || proposalsResult.error;
  if (firstError) throw new Error(firstError.message);

  return <AppShell>
    <PageHeader eyebrow="Expediente" title={String(caseRow.case_code)} description={`${String(caseRow.clients?.display_name || "Cliente")} · ${String(caseRow.destination || "Destino pendiente")}`} action={<a className="btn secondary" href="/expedientes">Volver</a>} />
    <CaseWorkspace
      role={session.role}
      initialCase={caseRow}
      initialPayments={paymentsResult.data || []}
      initialPurchases={purchasesResult.data || []}
      initialProposals={proposalsResult.data || []}
    />
  </AppShell>;
}
