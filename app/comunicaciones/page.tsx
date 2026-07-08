import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CommunicationsManager } from "./CommunicationsManager";

export default function CommunicationsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Comunicaciones"
        title="Historial de contacto operativo"
        description="Registro por expediente de conversaciones con cliente, proveedor y equipo interno, con estado y próxima fecha de seguimiento."
        action={<a className="btn" href="/tareas">Ver tareas</a>}
      />
      <CommunicationsManager />
    </AppShell>
  );
}
