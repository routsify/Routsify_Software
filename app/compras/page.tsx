import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationPurchases, listOrganizationSuppliers } from "@/lib/organization-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { PurchasesManagerOperational } from "./PurchasesManagerOperational";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ caseId?: string; supplierId?: string }> }) {
  const session = await requireAppPermission("purchases.view");
  const [{ caseId, supplierId }, purchaseResult, caseResult, supplierResult, syncRunResult, successfulSyncRunResult] = await Promise.all([
    searchParams,
    listOrganizationPurchases(session.organizationId),
    listOrganizationCases(session.organizationId),
    listOrganizationSuppliers(session.organizationId),
    getSupabaseAdminClient().from("integration_runs")
      .select("id,status,started_at,finished_at,summary,last_error")
      .eq("organization_id", session.organizationId)
      .eq("integration", "holded_supplier_invoices")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSupabaseAdminClient().from("integration_runs")
      .select("finished_at,started_at")
      .eq("organization_id", session.organizationId)
      .eq("integration", "holded_supplier_invoices")
      .eq("status", "done")
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
      <PurchasesManagerOperational initialPurchases={purchases} initialCases={cases} initialSuppliers={suppliers} initialSyncRun={syncRunResult.data || null} initialLastSuccessfulSyncAt={successfulSyncRunResult.data?.finished_at || successfulSyncRunResult.data?.started_at || null} generatedAt={new Date().toISOString()} initialCaseId={caseId || ""} initialSupplierId={supplierId || ""} />
    </AppShell>
  );
}
