import { defaultSettings, moduleFor, settingValueToText, type AppSetting } from "@/lib/settings-master";

const visibleModules = new Set(["general", "appearance", "clients", "cases", "budgets", "margins", "purchases", "integrations", "fiscal"]);

export function ProductionSettings({ storedRows = [] }: { storedRows?: Record<string, unknown>[] }) {
  const settings = defaultSettings
    .filter((setting) => visibleModules.has(setting.module) && setting.editable && !setting.isSensitive)
    .map((setting) => {
      const stored = storedRows.find((row) => String(row.key || "") === setting.key);
      return stored && stored.value !== undefined && stored.value !== null
        ? { ...setting, value: stored.value as AppSetting["value"] }
        : setting;
    });
  const margin = settings.find((setting) => setting.key === "margins.minimum");
  const fiscal = settings.find((setting) => setting.key === "fiscal.mode");
  const holded = settings.find((setting) => setting.key === "integrations.holded.mode");

  return <div className="settings-page" style={{ display: "grid", gap: 18 }}>
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Ajustes visibles</strong><b>{settings.length}</b><small>Configuración efectiva</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">M</span><span className="kpi-copy"><strong>Margen mínimo</strong><b>{settingValueToText(margin?.value ?? "—")}</b><small>Sobre venta</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">F</span><span className="kpi-copy"><strong>Fiscalidad</strong><b>{settingValueToText(fiscal?.value ?? "—")}</b><small>Revisión manual</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">H</span><span className="kpi-copy"><strong>Holded</strong><b>{settingValueToText(holded?.value ?? "—")}</b><small>Sin automatismos ocultos</small></span></div>
    </section>

    <section className="card">
      <div className="panel-head"><div><h2>Configuración de lanzamiento</h2><p>Valores efectivos para esta organización. Las credenciales y secretos nunca se muestran en esta pantalla.</p></div></div>
      <div className="table-scroll"><table>
        <thead><tr><th>Módulo</th><th>Ajuste</th><th>Valor actual</th><th>Clave</th></tr></thead>
        <tbody>{settings.map((setting) => <tr key={setting.id}><td>{moduleFor(setting.module).label}</td><td><strong>{setting.label}</strong><br/><small>{setting.description || "—"}</small></td><td>{settingValueToText(setting.value)}</td><td><code>{setting.key}</code></td></tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}
