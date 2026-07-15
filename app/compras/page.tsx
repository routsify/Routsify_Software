import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationPurchases, listOrganizationSuppliers } from "@/lib/organization-repositories";
import { PurchasesManagerOperational } from "./PurchasesManagerOperational";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ caseId?: string; supplierId?: string }> }) {
  const session = await requireAppPermission("purchases.view");
  const [{ caseId, supplierId }, purchaseResult, caseResult, supplierResult] = await Promise.all([
    searchParams,
    listOrganizationPurchases(session.organizationId),
    listOrganizationCases(session.organizationId),
    listOrganizationSuppliers(session.organizationId),
  ]);
  const purchases = purchaseResult.ok ? purchaseResult.data : [];
  const cases = caseResult.ok ? caseResult.data : [];
  const suppliers = supplierResult.ok ? supplierResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compras / Proveedores"
        title="Compras y proveedores"
        description="Controla cada compra prevista, su proveedor maestro, factura, coste real y desviación respecto al presupuesto."
        action={<Link className="btn secondary" href="/proveedores" prefetch={false}>Directorio de proveedores</Link>}
      />
      <PurchasesManagerOperational initialPurchases={purchases} initialCases={cases} initialSuppliers={suppliers} initialCaseId={caseId || ""} initialSupplierId={supplierId || ""} />
    </AppShell>
  );
}
