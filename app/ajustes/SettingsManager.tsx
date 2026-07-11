"use client";

import { defaultSettings, moduleFor, settingValueToText, settingsSummary } from "@/lib/settings-master";

export function SettingsManager() {
  const summary = settingsSummary(defaultSettings);

  return (
    <div className="settings-page" style={{ display: "grid", gap: 18 }}>
      <section className="card">
        <div className="panel-head">
          <div>
            <h2>Configuración de producción</h2>
            <p>Vista estable de ajustes base del sistema.</p>
          </div>
          <a className="btn secondary" href="/api/routsify/settings/audit">Ver auditoría</a>
        </div>
        <div className="grid grid-3">
          <div className="card"><span className="badge">Total</span><div className="metric">{summary.totalSettings}</div><p>Ajustes registrados.</p></div>
          <div className="card"><span className="badge">Editables</span><div className="metric">{summary.editable}</div><p>Configuración segura.</p></div>
          <div className="card"><span className="badge">Recalcular</span><div className="metric">{summary.recalculations}</div><p>Cambios con impacto operativo.</p></div>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Ajuste</th><th>Clave</th><th>Valor</th><th>Módulo</th></tr></thead>
          <tbody>
            {defaultSettings.map((setting) => (
              <tr key={setting.id}>
                <td><strong>{setting.label}</strong><br/><small>{setting.description || ""}</small></td>
                <td>{setting.key}</td>
                <td>{settingValueToText(setting.value)}</td>
                <td>{moduleFor(setting.module).label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
