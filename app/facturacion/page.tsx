import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BillingManager } from "./BillingManager";

export default function BillingPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Pagos y facturación"
        title="Cobros manuales y documentos fiscales"
        description="Control operativo de pagos, borradores fiscales y estado de sincronización con el sistema externo. En el MVP los pagos son manuales."
        action={<a className="btn" href="/cierre">Ver cierre</a>}
      />
      <BillingManager />
    </AppShell>
  );
}
