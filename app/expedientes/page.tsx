import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CasesManager } from "./CasesManager";

export default function CasesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Expedientes"
        title="Centro operativo de expedientes"
        description="Listado, filtros, próxima acción, bloqueos, timeline, flujo, responsable, prioridad y acciones rápidas para saber qué hacer ahora en cada viaje."
      />
      <CasesManager />
    </AppShell>
  );
}
