import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ClientsManager } from "./ClientsManager";

export default function ClientsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Clientes"
        title="Ficha maestra de clientes"
        description="Cliente único, deduplicación por email/teléfono, fiscalidad mínima, estado Holded, historial y acciones rápidas conectadas con expedientes y presupuestos."
      />
      <ClientsManager />
    </AppShell>
  );
}
