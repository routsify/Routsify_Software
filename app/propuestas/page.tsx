import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BudgetManager } from "./BudgetManager";

export default function ProposalsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Propuestas y presupuesto"
        title="Presupuesto nativo versionado"
        description="Aquí se toca el margen desde cada presupuesto. Cada línea calcula coste, margen, venta y si genera compra esperada de proveedor."
        action={<a className="btn" href="/propuestas/demo-public-token">Abrir propuesta pública</a>}
      />
      <BudgetManager />
    </AppShell>
  );
}
