import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ReportsManager } from "./ReportsManager";

export default function ReportsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Informes"
        title="Centro de decisión diaria"
        description="Mide venta aceptada, ingresos confirmados, margen, tiempos por fase, puntos de dolor, proveedores que bloquean cierre, rentabilidad y equipo."
      />
      <ReportsManager />
    </AppShell>
  );
}
