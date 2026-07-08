import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ContractsManager } from "./ContractsManager";

export default function ContractsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Contratos"
        title="Contratos operativos"
        description="Control del contrato asociado a una propuesta aceptada: documentación, archivo, estado y paso a pagos."
        action={<a className="btn" href="/facturacion">Ver pagos</a>}
      />
      <ContractsManager />
    </AppShell>
  );
}
