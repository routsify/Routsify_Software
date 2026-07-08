import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CloseManager } from "./CloseManager";

export default function ClosePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Cierre operativo"
        title="Control antes de cerrar expediente"
        description="Checklist para decidir si un viaje puede cerrarse: contrato, pago, facturas proveedor, documento fiscal y notas finales."
        action={<a className="btn" href="/compras">Ver compras</a>}
      />
      <CloseManager />
    </AppShell>
  );
}
