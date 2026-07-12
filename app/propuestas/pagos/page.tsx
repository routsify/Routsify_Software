import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { PaymentLinksManager } from "./PaymentLinksManager";

function one(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export default async function ProposalPaymentsPage() {
  const session = await requireAppSession();
  const { data } = await getSupabaseAdminClient().from("proposals")
    .select("id,status,current_version_id,cases(id,case_code,destination,accepted_value,currency,clients(display_name)),proposal_versions!proposals_current_version_fk(id,total_sale,payment_links(*))")
    .eq("organization_id", session.organizationId).eq("status", "accepted").order("updated_at", { ascending: false });
  const proposals = (data || []).map((row) => {
    const caseRow = one(row.cases); const client = one(caseRow?.clients); const version = one(row.proposal_versions);
    return { id: String(row.id), caseCode: String(caseRow?.case_code || "Expediente"), clientName: String(client?.display_name || "Cliente"), destination: String(caseRow?.destination || ""), total: Number(version?.total_sale || caseRow?.accepted_value || 0), currency: String(caseRow?.currency || "EUR"), paymentLinks: Array.isArray(version?.payment_links) ? version.payment_links : [] };
  });
  return <AppShell><PageHeader eyebrow="Presupuestos" title="Pagos Teya" description="Guarda el enlace externo por presupuesto y confirma manualmente el cobro." /><div className="page-actions"><Link className="btn secondary" href="/propuestas">Volver a presupuestos</Link></div><PaymentLinksManager initialProposals={proposals} /></AppShell>;
}
