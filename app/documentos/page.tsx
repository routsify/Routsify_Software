import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { DocumentsManager } from "./DocumentsManager";

export default function DocumentsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Documentos"
        title="Repositorio documental"
        description="Documentos por expediente: propuestas, contratos, viajeros, proveedor y pagos. Preparado para almacenamiento privado cuando pasemos a datos reales."
        action={<a className="btn" href="/expedientes">Ver expedientes</a>}
      />
      <DocumentsManager />
    </AppShell>
  );
}
