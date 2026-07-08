import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ClientsManager } from "./ClientsManager";

export default function ClientsPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="CRM operativo" title="Clientes" description="Vista completa de campos de cliente según el modelo MVP: fiscal/comercial, deduplicación por email/teléfono y referencia Holded." action={<button className="btn">Nuevo cliente</button>} />
      <ClientsManager />
    </AppShell>
  );
}
