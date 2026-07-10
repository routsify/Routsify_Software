import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listPurchasesRepository } from "@/lib/server-repositories";
import { PurchasesManager } from "./PurchasesManager";

export default async function PurchasesPage() {
  const result = await listPurchasesRepository();
  const purchases = result.ok ? result.data : [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compras / Proveedores"
        title="Compras y proveedores"
        description="Controla compras, proveedores, importes y estados. Los estados se pueden corregir en cualquier momento."
      />
      <PurchasesManager initialPurchases={purchases} />
    </AppShell>
  );
}
