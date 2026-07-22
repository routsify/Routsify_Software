import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationPurchases, listOrganizationSuppliers } from "@/lib/organization-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { PurchasesManagerOperational } from "./PurchasesManagerOperational";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ caseId?: string; supplierId?: string }> }) {
  const session = await requireAppPermission("purchases.view");
  const [{ caseId, supplierId }, purchaseResult, caseResult, supplierResult, syncRunResult] = await Promise.all([
    searchParams,
    listOrganizationPurchases(session.organizationId),
    listOrganizationCases(session.organizationId),
    listOrganizationSuppliers(session.organizationId),
    getSupabaseAdminClient().from("integration_runs")
      .select("id,status,started_at,finished_at,summary,last_error")
      .eq("organization_id", session.organizationId)
      .eq("integration", "holded_supplier_invoices")
      .eq("kind", "cron")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const purchases = purchaseResult.ok ? purchaseResult.data : [];
  const cases = caseResult.ok ? caseResult.data : [];
  const suppliers = supplierResult.ok ? supplierResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compras / Proveedores"
        title="Facturas de proveedor"
        description="Controla las facturas esperadas por proveedor. Holded recibe y lee las facturas; Routsify las sincroniza, concilia y muestra lo que falta."
        action={<Link className="btn secondary" href="/proveedores" prefetch={false}>Directorio de proveedores</Link>}
      />
      <PurchasesManagerOperational initialPurchases={purchases} initialCases={cases} initialSuppliers={suppliers} initialSyncRun={syncRunResult.data || null} initialCaseId={caseId || ""} initialSupplierId={supplierId || ""} />
    </AppShell>
  );
}
