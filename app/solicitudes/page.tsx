import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { RequestsManager } from "./RequestsManager";

export default function RequestsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Solicitudes"
        title="Entrada comercial y booking"
        description="Bandeja previa a cliente y expediente: entradas desde Fillout, Booking API, email o alta manual."
        action={<a className="btn" href="/clientes">Ver clientes</a>}
      />
      <RequestsManager />
    </AppShell>
  );
}
