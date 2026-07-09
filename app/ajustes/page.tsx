import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SettingsManager } from "./SettingsManager";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Ajustes"
        title="Panel de control de Routsify"
        description="Configura módulos, integraciones, márgenes, estados, documentos, informes, roles, fiscalidad, logs y sistema desde una sola zona."
        action={<a className="btn" href="/api/routsify/settings/export">Exportar configuración</a>}
      />
      <SettingsManager />
    </AppShell>
  );
}
