import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { IntegrationsManager } from "./IntegrationsManager";

export default function IntegrationsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Integraciones"
        title="Entradas, cola y tareas operativas"
        description="Control de entradas desde formularios y booking, cola de eventos, reintentos y tareas programadas. En el MVP prima la trazabilidad sobre la automatización agresiva."
        action={<a className="btn" href="/facturacion">Ver facturación</a>}
      />
      <IntegrationsManager />
    </AppShell>
  );
}
