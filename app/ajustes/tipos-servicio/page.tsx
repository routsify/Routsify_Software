import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ServiceTypesManager } from "./ServiceTypesManager";

export default function ServiceTypesPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Configuración" title="Tipos de servicio" description="Los tipos mínimos salen preparados como tabla configurable para ampliarlos desde backoffice sin tocar código." action={<button className="btn">Añadir tipo</button>} />
      <ServiceTypesManager />
    </AppShell>
  );
}
