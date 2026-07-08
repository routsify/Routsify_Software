import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { TasksManager } from "./TasksManager";

export default function TasksPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Tareas"
        title="Cola operativa diaria"
        description="Acciones por expediente, responsable, prioridad, vencimiento y estado. Sirve como bandeja común de ventas, operaciones y facturación."
        action={<a className="btn" href="/expedientes">Ver expedientes</a>}
      />
      <TasksManager />
    </AppShell>
  );
}
