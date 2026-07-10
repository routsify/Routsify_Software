import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProductionSettings } from "./ProductionSettings";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Ajustes"
        title="Ajustes del sistema"
        description="Configuración básica de empresa, márgenes, presupuestos, compras, fiscalidad e integraciones."
      />
      <ProductionSettings />
    </AppShell>
  );
}
