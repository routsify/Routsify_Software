import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { listOrganizationCases, listOrganizationPurchases } from "@/lib/organization-repositories";
import { PurchasesManagerOperational } from "./PurchasesManagerOperational";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const session = await requireAppSession();
  const [{ caseId }, purchaseResult, caseResult] = await Promise.all([
    searchParams,
    listOrganizationPurchases(session.organizationId),
    listOrganizationCases(session.organizationId),
  ]);
  const purchases = purchaseResult.ok ? purchaseResult.data : [];
  const cases = caseResult.ok ? caseResult.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compras / Proveedores"
        title="Compras y proveedores"
        description="Controla cada compra prevista, su expediente, proveedor, importe y estado."
      />
      <PurchasesManagerOperational initialPurchases={purchases} initialCases={cases} initialCaseId={caseId || ""} />
    </AppShell>
  );
}
