import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SecurityManager } from "./SecurityManager";

export default function SecurityPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Seguridad interna"
        title="Equipo, roles y auditoría"
        description="Control de usuarios internos, permisos por rol y registro de acciones sensibles. Preparado para RLS cuando activemos Supabase real."
        action={<a className="btn" href="/integraciones">Ver integraciones</a>}
      />
      <SecurityManager />
    </AppShell>
  );
}
