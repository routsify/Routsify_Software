import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listCasesRepository, listPurchasesRepository } from "@/lib/server-repositories";
import { PurchasesManager } from "./PurchasesManager";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const [{ caseId }, purchaseResult, caseResult] = await Promise.all([
    searchParams,
    listPurchasesRepository(),
    listCasesRepository(),
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
      <PurchasesManager initialPurchases={purchases} initialCases={cases} initialCaseId={caseId || ""} />
    </AppShell>
  );
}
