import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listCaseDirectoryPage } from "@/lib/case-directory-server";
import { hasPermission } from "@/lib/rbac";
import { CaseHealthDirectory } from "./CaseHealthDirectory";

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const session = await requireAppPermission("cases.view");
  const canManage = hasPermission(session.role, "cases.manage");
  const [{ caseId }, initialPage] = await Promise.all([
    searchParams,
    listCaseDirectoryPage(session.organizationId, { page: 1, pageSize: 50, status: "active", health: "all" }),
  ]);

  return <AppShell>
    <PageHeader
      eyebrow="Expedientes"
      title="Salud operativa de los viajes"
      description="Prioriza cada expediente según contrato, cobros, compras, tareas, viajeros, documentos, fechas y margen real."
      action={canManage ? <Link className="btn" href={caseId ? `/expedientes/gestionar?caseId=${encodeURIComponent(caseId)}` : "/expedientes/gestionar"}>Crear o editar expediente</Link> : undefined}
    />
    <CaseHealthDirectory initialPage={initialPage} initialCaseId={caseId || ""} />
  </AppShell>;
}
