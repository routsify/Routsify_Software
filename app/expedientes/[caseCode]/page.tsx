import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
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

  const results = await Promise.all([
    supabase.from("travelers").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at"),
    supabase.from("documents").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
    supabase.from("timeline_events").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("contracts").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
    supabase.from("billing_documents").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
    supabase.from("expected_purchases").select("*").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
    supabase.from("proposals").select("*,proposal_versions(*,budget_lines(*),payment_links(*))").eq("case_id", caseRow.id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }),
  ]);
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);
  const [travelers, documents, tasks, timeline, contracts, payments, fiscal, purchases, proposals] = results.map((result) => result.data || []);

  return <AppShell>
    <PageHeader eyebrow="Expediente" title={String(caseRow.case_code)} description={`${String(caseRow.clients?.display_name || "Cliente")} · ${String(caseRow.destination || "Destino pendiente")}`} action={<a className="btn secondary" href="/expedientes">Volver</a>} />
    <CaseWorkspace role={session.role} initialCase={caseRow} initialTravelers={travelers} initialDocuments={documents} initialTasks={tasks} initialTimeline={timeline} initialContracts={contracts} initialPayments={payments} initialFiscal={fiscal} initialPurchases={purchases} initialProposals={proposals} />
  </AppShell>;
}
