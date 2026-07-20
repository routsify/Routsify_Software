import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationClients } from "@/lib/organization-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { CasesManager } from "../CasesManager";

export default async function ManageCasesPage({ searchParams }: { searchParams: Promise<{ clientId?: string; caseId?: string }> }) {
  const session = await requireAppPermission("cases.manage");
  const [{ clientId, caseId }, caseResult, clientResult] = await Promise.all([
    searchParams,
    listOrganizationCases(session.organizationId),
    listOrganizationClients(session.organizationId),
  ]);
  let cases = caseResult.ok ? caseResult.data : [];
  if (caseId && !cases.some((item) => String((item as { id?: unknown }).id || "") === caseId)) {
    const { data } = await getSupabaseAdminClient().from("cases").select("*, clients(display_name,email,phone,holded_contact_id)").eq("organization_id", session.organizationId).eq("id", caseId).maybeSingle();
    if (data) cases = [data, ...cases];
  } else if (caseId) {
    cases = [...cases].sort((left, right) => Number(String((right as { id?: unknown }).id || "") === caseId) - Number(String((left as { id?: unknown }).id || "") === caseId));
  }

  return <AppShell>
    <PageHeader
      eyebrow="Gestión de expedientes"
      title="Crear y editar viajes"
      description="Modifica datos, fechas, estado y siguiente acción. La salud operativa se recalculará automáticamente al volver al directorio."
      action={<Link className="btn secondary" href={caseId ? `/expedientes?caseId=${encodeURIComponent(caseId)}` : "/expedientes"}>Volver a salud operativa</Link>}
    />
    <CasesManager initialCases={cases} initialClients={clientResult.ok ? clientResult.data : []} initialClientId={clientId || ""} />
  </AppShell>;
}
