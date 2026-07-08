import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PurchasesManager } from "./PurchasesManager";

export default function PurchasesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Compras y proveedores"
        title="Facturas proveedor pendientes"
        description="Seguimiento de compras esperadas, subida manual de facturas proveedor, revisión humana y criterio de cierre operativo. Sin OCR en el MVP."
        action={<a className="btn" href="/propuestas">Ver presupuesto</a>}
      />
      <PurchasesManager />
    </AppShell>
  );
}
