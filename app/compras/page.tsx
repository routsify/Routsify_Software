import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PurchasesManager } from "./PurchasesManager";

export default function PurchasesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Compras / Proveedores"
        title="Conciliación de compras esperadas"
        description="Routsify controla qué facturas proveedor se esperan; Holded aporta compras reales; esta pantalla propone matches, aprueba costes reales y bloquea el cierre si falta algo obligatorio."
      />
      <PurchasesManager />
    </AppShell>
  );
}
