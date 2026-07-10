import { defaultSettings, moduleFor, settingValueToText } from "@/lib/settings-master";

const visibleModules = new Set(["general", "appearance", "clients", "cases", "budgets", "margins", "purchases", "integrations", "fiscal"]);

export function ProductionSettings() {
  const settings = defaultSettings.filter((setting) => visibleModules.has(setting.module) && setting.editable && !setting.isSensitive);
  const margin = settings.find((setting) => setting.key === "margins.minimum");
  const fiscal = settings.find((setting) => setting.key === "fiscal.mode");
  const holded = settings.find((setting) => setting.key === "integrations.holded.mode");

  return <div className="settings-page" style={{ display: "grid", gap: 18 }}>
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Ajustes visibles</strong><b>{settings.length}</b><small>Editables seguros</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">M</span><span className="kpi-copy"><strong>Margen mínimo</strong><b>{settingValueToText(margin?.value ?? "—")}</b><small>Sobre venta</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">F</span><span className="kpi-copy"><strong>Fiscalidad</strong><b>{settingValueToText(fiscal?.value ?? "—")}</b><small>Revisión manual</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">H</span><span className="kpi-copy"><strong>Holded</strong><b>{settingValueToText(holded?.value ?? "—")}</b><small>Sin automatismos ocultos</small></span></div>
    </section>

    <section className="card">
      <div className="panel-head"><div><h2>Configuración de lanzamiento</h2><p>Esta pantalla muestra únicamente ajustes seguros para operar. Las acciones técnicas, importaciones, exportaciones y sincronizaciones automáticas quedan fuera de la interfaz hasta validación final.</p></div></div>
      <table>
        <thead><tr><th>Módulo</th><th>Ajuste</th><th>Valor actual</th><th>Clave</th></tr></thead>
        <tbody>{settings.map((setting) => <tr key={setting.id}><td>{moduleFor(setting.module).label}</td><td><strong>{setting.label}</strong><br/><small>{setting.description || "—"}</small></td><td>{settingValueToText(setting.value)}</td><td><code>{setting.key}</code></td></tr>)}</tbody>
      </table>
    </section>
  </div>;
}
