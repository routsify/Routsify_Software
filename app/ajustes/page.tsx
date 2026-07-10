import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SettingsManager } from "./SettingsManager";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Ajustes"
        title="Ajustes del sistema"
        description="Configuración básica de empresa, márgenes, presupuestos, compras, seguridad e integraciones. Solo se muestran ajustes editables y seguros."
      />
      <SettingsManager />
    </AppShell>
  );
}
