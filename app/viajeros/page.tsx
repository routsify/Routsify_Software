import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { TravelersManager } from "./TravelersManager";

export default function TravelersPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Viajeros y documentos"
        title="Documentación mínima por expediente"
        description="Registro operativo de viajeros, documentos, caducidades y estado de revisión antes de contrato, proveedores y cierre."
        action={<a className="btn" href="/cierre">Ver cierre</a>}
      />
      <TravelersManager />
    </AppShell>
  );
}
