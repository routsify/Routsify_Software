"use client";

import { useMemo, useState } from "react";
import { AppSetting, changedSettings, demoSettings, demoSettingsAuditLog, filterSettings, moduleFor, quickActions, resetModuleDemo, settingValueToText, settingsForModule, settingsModules, settingsSummary, systemInfo, updateSettingsDemo, validateSetting } from "@/lib/settings-master";

function SettingInput({ setting, onChange }: { setting: AppSetting; onChange: (value: AppSetting["value"]) => void }) {
  if (setting.valueType === "boolean") return <input type="checkbox" checked={Boolean(setting.value)} onChange={(event) => onChange(event.target.checked)} />;
  if (setting.valueType === "number") return <input className="input" type="number" value={Number(setting.value)} onChange={(event) => onChange(Number(event.target.value))} />;
  if (setting.valueType === "color") return <input type="color" value={String(setting.value)} onChange={(event) => onChange(event.target.value)} />;
  if (setting.valueType === "select") return <select value={String(setting.value)} onChange={(event) => onChange(event.target.value)}>{(setting.options || []).map((option) => <option key={option}>{option}</option>)}</select>;
  if (setting.valueType === "multi_select") return <textarea className="input" rows={3} value={Array.isArray(setting.value) ? setting.value.join("\n") : String(setting.value)} onChange={(event) => onChange(event.target.value.split("\n").filter(Boolean))} />;
  return <input className="input" value={String(setting.value)} onChange={(event) => onChange(event.target.value)} />;
}

export function SettingsManager() {
  const [settings, setSettings] = useState<AppSetting[]>(demoSettings);
  const [activeModule, setActiveModule] = useState("general");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [audit, setAudit] = useState(demoSettingsAuditLog);
  const summary = useMemo(() => settingsSummary(settings), [settings]);
  const visible = useMemo(() => query ? filterSettings(settings, query) : settingsForModule(activeModule, settings), [settings, activeModule, query]);
  const changed = useMemo(() => changedSettings(settings), [settings]);
  const info = systemInfo();

  function updateSetting(id: string, value: AppSetting["value"]) {
    setSettings((current) => current.map((setting) => setting.id === id ? { ...setting, value } : setting));
    setMessage("Cambios sin guardar");
  }

  function saveModule() {
    const errors = visible.map(validateSetting).filter(Boolean);
    if (errors.length) return setMessage(errors.join(" · "));
    const result = updateSettingsDemo(settings, visible);
    setSettings(result.settings);
    setAudit((current) => [...result.audits, ...current]);
    setMessage(`Guardado. Eventos: ${result.events.join(", ") || "settings.updated"}`);
  }

  function saveAll() {
    const result = updateSettingsDemo(settings, changed.length ? changed : settings);
    setAudit((current) => [...result.audits, ...current]);
    setMessage(`Guardar todos: ${result.audits.length} cambios auditados`);
  }

  function resetActive() {
    const result = resetModuleDemo(activeModule, settings);
    setSettings(result.settings);
    setAudit((current) => [...result.audits, ...current]);
    setMessage("Módulo restaurado a valores por defecto");
  }

  return <div className="settings-page" style={{ display: "grid", gap: 18 }}>
    <section className="card">
      <div className="panel-head"><div><h2>Resumen de configuración</h2><p>Estado actual del sistema y de los módulos principales.</p></div><a className="btn secondary" href="/api/routsify/settings/audit">Ver logs del sistema</a></div>
      <div className="client-kpis" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        <a className="kpi-card" href="/clientes"><span className="kpi-icon">👥</span><span className="kpi-copy"><strong>Clientes</strong><b>{summary.clients}</b><small>Sincronizado con Holded</small></span></a>
        <a className="kpi-card" href="/expedientes"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Expedientes activos</strong><b>{summary.activeCases}</b><small>Todo correcto</small></span></a>
        <a className="kpi-card" href="/propuestas"><span className="kpi-icon">📄</span><span className="kpi-copy"><strong>Presupuestos mes</strong><b>{summary.monthlyBudgets}</b><small>Sin incidencias</small></span></a>
        <a className="kpi-card" href="/compras"><span className="kpi-icon">🛒</span><span className="kpi-copy"><strong>Compras pendientes</strong><b>{summary.pendingPurchases}</b><small>6 requieren atención</small></span></a>
        <a className="kpi-card" href="/ajustes?search=Holded"><span className="kpi-icon">☁</span><span className="kpi-copy"><strong>Holded</strong><b>{summary.holdedStatus}</b><small>Última sync: hace 12 min</small></span></a>
        <a className="kpi-card" href="/ajustes?search=OCR"><span className="kpi-icon">🤖</span><span className="kpi-copy"><strong>IA / OCR</strong><b>{summary.ocrStatus}</b><small>Confianza OCR media · Retención controlada</small></span></a>
      </div>
    </section>
    <section className="card" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}><input className="input" placeholder="Buscar margen, Holded, color, informes, OCR..." value={query} onChange={(event) => setQuery(event.target.value)} /><button className="btn" type="button" onClick={saveAll}>Guardar todos los cambios</button></section>
    <div className="reports-tabs" style={{ display: "flex", gap: 8, overflowX: "auto" }}>{settingsModules.map((module) => <button key={module.id} className={activeModule === module.id && !query ? "btn" : "btn secondary"} type="button" onClick={() => { setActiveModule(module.id); setQuery(""); }}>{module.icon} {module.label}</button>)}</div>
    <section className="clients-layout"><div className="card clients-main"><div className="panel-head"><div><h2>{query ? "Resultados de búsqueda" : moduleFor(activeModule).label}</h2><p>{query ? `Coincidencias para ${query}` : moduleFor(activeModule).description}</p></div><div style={{ display: "flex", gap: 8 }}><button className="btn secondary" type="button" onClick={resetActive}>Restaurar módulo</button><button className="btn" type="button" onClick={saveModule}>Guardar cambios</button></div></div>{message ? <p className="client-message">{message}</p> : null}<div className="grid grid-2">{visible.map((setting) => { const dirty = changed.some((item) => item.id === setting.id); return <article key={setting.id} className="card" style={{ boxShadow: "none", borderColor: dirty ? "#0c7a43" : "#e5edf0" }}><div className="panel-head"><div><span className="badge">{moduleFor(setting.module).label}</span><h3>{setting.label}</h3></div>{dirty ? <span className="status-pill priority-normal">Cambios sin guardar</span> : <span className="status-pill status-progress">Sin cambios</span>}</div><p>{setting.description || setting.key}</p><SettingInput setting={setting} onChange={(value) => updateSetting(setting.id, value)} /><table style={{ marginTop: 12 }}><tbody><tr><th>Clave</th><td>{setting.key}</td></tr><tr><th>Defecto</th><td>{settingValueToText(setting.defaultValue)}</td></tr><tr><th>Evento</th><td>{setting.eventName || moduleFor(setting.module).eventName}</td></tr><tr><th>Afecta</th><td>{(setting.affectedModules || [setting.module]).join(", ")}</td></tr></tbody></table></article>; })}</div></div><aside className="client-side card"><section className="side-section"><h3>Acciones rápidas</h3>{quickActions.map((action) => <button key={action.id} className="quick-action" type="button" onClick={() => setMessage(`${action.label}: ${action.eventName}`)}><span>{action.label}<br/><small>{action.description}</small></span><b>→</b></button>)}</section><section className="side-section"><h3>Información del sistema</h3><table><tbody><tr><th>Versión</th><td>{info.version}</td></tr><tr><th>Entorno</th><td>{info.environment}</td></tr><tr><th>BD</th><td>{info.database}</td></tr><tr><th>Backups</th><td>{info.backupStatus}</td></tr></tbody></table></section><section className="side-section"><h3>Auditoría reciente</h3>{audit.slice(0, 5).map((item) => <p key={item.id}><strong>{item.settingKey}</strong><br/><small>{item.oldValue} → {item.newValue}</small></p>)}</section></aside></section>
  </div>;
}
