import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BudgetManager } from "./BudgetManager";

export default function ProposalsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Presupuestos"
        title="Motor económico versionado"
        description="Presupuestos conectados a cliente y expediente: líneas, margen, versiones, envío, aceptación, compras esperadas, tareas, Holded e informes."
      />
      <BudgetManager />
    </AppShell>
  );
}
