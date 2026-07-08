import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SuppliersManager } from "./SuppliersManager";

export default function SuppliersPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Proveedores"
        title="Base operativa de proveedores"
        description="Gestión de proveedores por destino, categoría, contacto, condiciones, estado y riesgo antes de presupuestar o cerrar compras."
        action={<a className="btn" href="/compras">Ver compras</a>}
      />
      <SuppliersManager />
    </AppShell>
  );
}
