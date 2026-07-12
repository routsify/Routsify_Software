"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { defaultSettings, moduleFor, type AppSetting } from "@/lib/settings-master";
import { IntegrationSecretsPanel } from "./IntegrationSecretsPanel";
import { UserManagementPanel } from "./UserManagementPanel";

type SecretStatus = { key: "holded_api_key" | "openai_api_key" | "fillout_webhook_secret" | "booking_webhook_secret"; configured: boolean; updatedAt: string | null };
type TabId = "general" | "appearance" | "users" | "integrations" | "operations" | "security";

const tabs: Array<{ id: TabId; label: string; description: string; modules: string[] }> = [
  { id: "general", label: "General", description: "Empresa, moneda, fechas y menú visible.", modules: ["general", "navigation"] },
  { id: "appearance", label: "Apariencia", description: "Colores, tipografía, densidad y composición.", modules: ["appearance"] },
  { id: "users", label: "Usuarios", description: "Altas, invitaciones, roles y permisos.", modules: [] },
  { id: "integrations", label: "Integraciones", description: "Fillout, Routsify Booking, Holded y OCR.", modules: ["integrations"] },
  { id: "operations", label: "Operativa", description: "Clientes, expedientes, presupuestos, márgenes y compras.", modules: ["clients", "cases", "budgets", "margins", "purchases", "contracts", "fiscal"] },
  { id: "security", label: "Seguridad y sistema", description: "Webhooks, logs, caché y políticas técnicas.", modules: ["security", "logs", "system"] },
];

function sameValue(left: AppSetting["value"], right: AppSetting["value"]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function ProductionSettings({ storedRows = [], secretStatuses = [], canManageSecrets = false, isAdmin = canManageSecrets }: { storedRows?: Record<string, unknown>[]; secretStatuses?: SecretStatus[]; canManageSecrets?: boolean; isAdmin?: boolean }) {
  const router = useRouter();
  const initialSettings = useMemo(() => defaultSettings.map((setting) => {
    const stored = storedRows.find((row) => String(row.key || "") === setting.key);
    return stored && stored.value !== undefined && stored.value !== null ? { ...setting, value: stored.value as AppSetting["value"] } : setting;
  }), [storedRows]);
  const initialValues = useMemo(() => Object.fromEntries(initialSettings.map((setting) => [setting.key, setting.value])) as Record<string, AppSetting["value"]>, [initialSettings]);
  const [savedValues, setSavedValues] = useState(initialValues);
  const [draftValues, setDraftValues] = useState(initialValues);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirtyKeys = useMemo(() => initialSettings.filter((setting) => !sameValue(savedValues[setting.key], draftValues[setting.key])).map((setting) => setting.key), [draftValues, initialSettings, savedValues]);
  const activeDefinition = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const activeSettings = initialSettings.filter((setting) => activeDefinition.modules.includes(setting.module));
  const configuredSecrets = secretStatuses.filter((item) => item.configured).length;
  const filloutEnabled = draftValues["integrations.fillout.enabled"] === true;
  const bookingEnabled = draftValues["integrations.booking.enabled"] === true;

  function setValue(key: string, value: AppSetting["value"]) {
    setDraftValues((current) => ({ ...current, [key]: value }));
    setMessage(null); setError(null);
    if (key.startsWith("theme.")) applyThemePreview({ ...draftValues, [key]: value });
  }

  function applyThemePreview(values: Record<string, AppSetting["value"]>) {
    const shell = document.querySelector<HTMLElement>(".shell");
    if (!shell) return;
    const propertyMap: Record<string, string> = {
      "--brand": String(values["theme.primary"] || "#379237"),
      "--sidebar": String(values["theme.sidebar"] || "#14532d"),
      "--accent": String(values["theme.accent"] || "#f0a528"),
      "--app-background": String(values["theme.background"] || "#f7faf7"),
      "--surface": String(values["theme.surface"] || "#ffffff"),
      "--radius-card": `${Number(values["theme.radius"] || 16)}px`,
      "--radius-control": `${Math.max(6, Number(values["theme.radius"] || 16) - 6)}px`,
      "--sidebar-width": `${Number(values["theme.sidebar_width"] || 236)}px`,
    };
    Object.entries(propertyMap).forEach(([property, value]) => shell.style.setProperty(property, value));
    shell.classList.remove("density-compact", "density-comfortable", "density-spacious");
    shell.classList.add(`density-${String(values["theme.density"] || "comfortable")}`);
  }

  async function saveChanges() {
    if (!isAdmin || !dirtyKeys.length) return;
    setBusy(true); setMessage(null); setError(null);
    const response = await fetch("/api/routsify/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: dirtyKeys.map((key) => ({ key, value: draftValues[key] })) }),
    });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !result?.ok) { setError(String(result?.error || "No se pudieron guardar los ajustes.")); return; }
    setSavedValues({ ...draftValues });
    const brand = document.querySelector<HTMLElement>(".brand span");
    if (brand) brand.textContent = String(draftValues["company.name"] || "Routsify");
    setMessage("Cambios guardados y aplicados. El sistema ha actualizado la configuración efectiva.");
    router.refresh();
  }

  function resetActiveTab() {
    if (!isAdmin) return;
    const keys = new Set(activeSettings.map((setting) => setting.key));
    const next = { ...draftValues };
    initialSettings.forEach((setting) => { if (keys.has(setting.key)) next[setting.key] = setting.defaultValue; });
    setDraftValues(next); setMessage(null); setError(null);
    if (activeTab === "appearance") applyThemePreview(next);
  }

  function renderField(setting: AppSetting) {
    const value = draftValues[setting.key] ?? setting.value;
    const changed = !sameValue(savedValues[setting.key], value);
    const disabled = !isAdmin || !setting.editable || busy;
    let control: React.ReactNode;

    if (setting.valueType === "boolean") {
      control = <label className="setting-toggle"><span>{value === true ? "Activado" : "Desactivado"}</span><input type="checkbox" checked={value === true} onChange={(event) => setValue(setting.key, event.target.checked)} disabled={disabled} /></label>;
    } else if (setting.valueType === "color") {
      control = <div className="setting-color-control"><input type="color" value={String(value)} onChange={(event) => setValue(setting.key, event.target.value)} disabled={disabled} /><input className="input" value={String(value)} onChange={(event) => setValue(setting.key, event.target.value)} disabled={disabled} /></div>;
    } else if (setting.valueType === "select") {
      control = <select value={String(value)} onChange={(event) => setValue(setting.key, event.target.value)} disabled={disabled}>{(setting.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select>;
    } else if (setting.valueType === "multi_select") {
      const selected = Array.isArray(value) ? value.map(String) : [];
      control = <div className="setting-multi">{(setting.options || []).map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} disabled={disabled} onChange={(event) => setValue(setting.key, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} /><span>{option}</span></label>)}</div>;
    } else if (setting.valueType === "number") {
      control = <input className="input" type="number" value={Number(value)} min={Number(setting.validationRules?.min) || undefined} max={Number(setting.validationRules?.max) || undefined} onChange={(event) => setValue(setting.key, Number(event.target.value))} disabled={disabled} />;
    } else {
      control = <input className="input" type={setting.key.includes("url") ? "url" : "text"} value={String(value)} onChange={(event) => setValue(setting.key, event.target.value)} disabled={disabled} placeholder={setting.validationRules?.allowEmpty ? "Pendiente de configurar" : undefined} />;
    }

    return <article className={`setting-field ${changed ? "changed" : ""}`} key={setting.key}>
      <div className="setting-field-head"><div><strong>{setting.label}</strong><p>{setting.description || moduleFor(setting.module).description}</p></div>{changed ? <span className="badge">Modificado</span> : null}</div>
      {control}
      <code>{setting.key}</code>
      {!setting.editable ? <small>Valor protegido por la política operativa o fiscal vigente.</small> : null}
    </article>;
  }

  const previewStyle = {
    "--preview-primary": String(draftValues["theme.primary"] || "#379237"),
    "--preview-sidebar": String(draftValues["theme.sidebar"] || "#14532d"),
    "--preview-background": String(draftValues["theme.background"] || "#f7faf7"),
    "--preview-surface": String(draftValues["theme.surface"] || "#ffffff"),
    "--preview-radius": `${Number(draftValues["theme.radius"] || 16)}px`,
  } as CSSProperties;

  return <div className="settings-page">
    <section className="settings-summary">
      <article className="settings-summary-card"><span>Control</span><strong>{isAdmin ? "Administrador" : "Consulta"}</strong><small>{isAdmin ? "Puedes modificar y aplicar la configuración." : "Los cambios están restringidos al administrador."}</small></article>
      <article className="settings-summary-card"><span>Cambios pendientes</span><strong>{dirtyKeys.length}</strong><small>{dirtyKeys.length ? "Pendientes de guardar" : "Configuración sincronizada"}</small></article>
      <article className="settings-summary-card"><span>Integraciones de entrada</span><strong>{Number(filloutEnabled) + Number(bookingEnabled)}/2</strong><small>Fillout y Routsify Booking activas</small></article>
      <article className="settings-summary-card"><span>Credenciales</span><strong>{configuredSecrets}/4</strong><small>Holded, OCR y secretos de webhooks</small></article>
    </section>

    <nav className="settings-tabs" aria-label="Secciones de ajustes">{tabs.map((tab) => <button key={tab.id} type="button" className={`settings-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => { setActiveTab(tab.id); setMessage(null); setError(null); }}>{tab.label}</button>)}</nav>

    {activeTab === "users" ? <UserManagementPanel canManage={isAdmin} /> : null}

    {activeTab !== "users" ? <section className="settings-section">
      <div className="settings-section-header"><div><span className="eyebrow">Panel de control</span><h2>{activeDefinition.label}</h2><p>{activeDefinition.description}</p></div>{isAdmin && activeSettings.some((setting) => setting.editable) ? <button className="btn secondary" type="button" onClick={resetActiveTab} disabled={busy}>Restaurar valores de esta sección</button> : null}</div>
      {activeTab === "appearance" ? <div className="settings-preview" style={previewStyle}><aside className="settings-preview-sidebar"><strong>{String(draftValues["company.name"] || "Routsify")}</strong><span>Inicio</span><span>Clientes</span><span>Expedientes</span><span>Presupuestos</span></aside><div className="settings-preview-main"><span className="eyebrow">Vista previa inmediata</span><h2>Así se aplicará el estilo</h2><p>Los cambios visuales se muestran antes de guardar y se propagan al sistema al confirmar.</p><article className="settings-preview-card"><strong>Tarjeta de ejemplo</strong><p>Colores, fondos, radios, densidad y ancho del menú.</p><span className="settings-preview-button">Acción principal</span></article></div></div> : null}
      {activeSettings.length ? <div className="settings-fields">{activeSettings.map(renderField)}</div> : null}
      {activeTab === "integrations" ? <IntegrationSecretsPanel initialStatuses={secretStatuses} canManage={canManageSecrets} /> : null}
    </section> : null}

    {activeTab !== "users" && isAdmin ? <div className="settings-savebar"><div><strong>{dirtyKeys.length ? `${dirtyKeys.length} cambios sin guardar` : "Todos los ajustes están guardados"}</strong><p>{dirtyKeys.length ? "Los cambios no afectarán al sistema hasta pulsar Guardar." : "La configuración efectiva coincide con la pantalla."}</p></div><button className="btn" type="button" onClick={() => void saveChanges()} disabled={busy || !dirtyKeys.length}>{busy ? "Guardando..." : "Guardar y aplicar cambios"}</button></div> : null}
    {message ? <p className="client-message settings-feedback" role="status">{message}</p> : null}
    {error ? <p className="form-warning settings-feedback" role="alert">{error}</p> : null}
  </div>;
}
