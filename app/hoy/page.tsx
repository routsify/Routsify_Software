import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppSession } from "@/lib/app-auth";
import { loadOperationalInbox } from "@/lib/operations-inbox-server";
import { TodayInbox } from "./TodayInbox";
import "./hoy.css";

export default async function TodayWorkbenchPage() {
  const session = await requireAppSession();
  const data = await loadOperationalInbox(session.organizationId);

  return <AppShell>
    <PageHeader
      eyebrow="Inicio operativo"
      title="Hoy"
      description="Qué requiere atención ahora, por qué importa y cuál es la siguiente acción más útil."
    />
    <TodayInbox initialData={data} />
  </AppShell>;
}
