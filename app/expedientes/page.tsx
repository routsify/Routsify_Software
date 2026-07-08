import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CasesManager } from "./CasesManager";

export default function CasesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Operación de viajes" title="Expedientes" description="Estado, próxima acción, bloqueo, cliente, fechas, destino y compras proveedor pendientes." action={<a className="btn" href="/propuestas">Crear presupuesto</a>} />
      <CasesManager />
    </AppShell>
  );
}
