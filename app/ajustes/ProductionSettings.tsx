"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { defaultSettings, moduleFor, type AppSetting } from "@/lib/settings-master";
import { enforceProtectedSettingValue, isProtectedSetting, protectedSettingDescription } from "@/lib/settings-invariants";
import { IntegrationSecretsPanel, type IntegrationSecretStatus } from "./IntegrationSecretsPanel";
import { LegalDocumentsPanel, type LegalDocumentRow } from "./LegalDocumentsPanel";
import { UserManagementPanel } from "./UserManagementPanel";
import { BrandLogoPanel } from "./BrandLogoPanel";

type TabId = "general" | "appearance" | "users" | "legal" | "integrations" | "ai" | "operations" | "security";

const tabs: Array<{ id: TabId; label: string; description: string; modules: string[] }> = [
  { id: "general", label: "General", description: "Empresa, moneda, fechas y menú visible.", modules: ["general", "navigation"] },
  { id: "appearance", label: "Apariencia", description: "Colores, tipografía, densidad y composición.", modules: ["appearance"] },
  { id: "users", label: "Usuarios", description: "Altas, invitaciones, roles y permisos.", modules: [] },
  { id: "integrations", label: "Integraciones", description: "Activa y conecta cada herramienta desde una tarjeta sencilla.", modules: ["integrations"] },
  { id: "ai", label: "AI", description: "Modelos y prompts que utiliza OpenAI. Los cambios se aplican a las siguientes ejecuciones.", modules: ["ai"] },
  { id: "operations", label: "Operativa", description: "Clientes, expedientes, presupuestos, márgenes, compras, contratos y fiscalidad.", modules: ["clients", "cases", "budgets", "margins", "purchases", "contracts", "fiscal"] },
  { id: "legal", label: "Documentación legal", description: "PDFs privados, versiones vigentes e histórico contractual.", modules: [] },
  { id: "security", label: "Seguridad y sistema", description: "Webhooks, logs, caché y políticas técnicas.", modules: ["security", "logs", "system"] },
];

function sameValue(left: AppSetting["value"], right: AppSetting["value"]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function ProductionSettings({ storedRows = [], secretStatuses = [], legalDocuments = [], canManageSecrets = false, isAdmin = canManageSecrets, initialTab = "general" }: { storedRows?: Record<string, unknown>[]; secretStatuses?: IntegrationSecretStatus[]; legalDocuments?: LegalDocumentRow[]; canManageSecrets?: boolean; isAdmin?: boolean; initialTab?: TabId }) {
  const router = useRouter();
  const initialSettings = useMemo(() => defaultSettings.map((setting) => {
    const stored = storedRows.find((row) => String(row.key || "") === setting.key);
    const storedValue = stored && stored.value !== undefined && stored.value !== null ? stored.value as AppSetting["value"] : setting.value;
    const protectedDescription = protectedSettingDescription(setting.key);
    return {
      ...setting,
      value: enforceProtectedSettingValue(setting.key, storedValue) as AppSetting["value"],
      editable: setting.editable && !isProtectedSetting(setting.key),
      description: protectedDescription || setting.description,
    };
  }), [storedRows]);
  const initialValues = useMemo(() => Object.fromEntries(initialSettings.map((setting) => [setting.key, setting.value])) as Record<string, AppSetting["value"]>, [initialSettings]);
  const [savedValues, setSavedValues] = useState(initialValues);
  const [draftValues, setDraftValues] = useState(initialValues);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirtyKeys = useMemo(() => initialSettings.filter((setting) => !sameValue(savedValues[setting.key], draftValues[setting.key])).map((setting) => setting.key), [draftValues, initialSettings, savedValues]);
  const activeDefinition = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const activeSettings = initialSettings.filter((setting) => activeDefinition.modules.includes(setting.module));
  const configuredSecrets = secretStatuses.filter((item) => item.configured).length;
  const activeLegalDocuments = legalDocuments.filter((item) => item.is_active && item.status === "ready").length;
  const storedLogoUrl = storedRows.find((row) => String(row.key || "") === "company.logo_url")?.value;
  const storedLogoPath = storedRows.find((row) => String(row.key || "") === "company.logo_path")?.value;

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

  function syncIntegrationSettings(updates: Record<string, AppSetting["value"]>) {
    setSavedValues((current) => ({ ...current, ...updates }));
    setDraftValues((current) => ({ ...current, ...updates }));
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
    } else if (setting.key.endsWith(".prompt")) {
      control = <textarea className="input setting-prompt" rows={12} value={String(value)} onChange={(event) => setValue(setting.key, event.target.value)} disabled={disabled} />;
    } else {
      control = <input className="input" type={setting.key.includes("url") ? "url" : "text"} value={String(value)} onChange={(event) => setValue(setting.key, event.target.value)} disabled={disabled} placeholder={setting.validationRules?.allowEmpty ? "Pendiente de configurar" : undefined} />;
    }

    return <article className={`setting-field ${changed ? "changed" : ""}`} key={setting.key}>
      <div className="setting-field-head"><div><strong>{setting.label}</strong><p>{setting.description || moduleFor(setting.module).description}</p></div>{changed ? <span className="badge">Modificado</span> : null}</div>
      {control}
      <code>{setting.key}</code>
      {!setting.editable ? <small>Valor protegido por una garantía de integridad, seguridad o política operativa.</small> : null}
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
      <article className="settings-summary-card"><span>Control</span><strong>{isAdmin ? "Administrador" : "Consulta"}</strong><small>{isAdmin ? "Puedes modificar la configuración." : "Los cambios están restringidos."}</small></article>
      <article className="settings-summary-card"><span>Cambios pendientes</span><strong>{dirtyKeys.length}</strong><small>{dirtyKeys.length ? "Pendientes de guardar" : "Todo sincronizado"}</small></article>
      <article className="settings-summary-card"><span>Credenciales seguras</span><strong>{configuredSecrets}</strong><small>Guardadas de forma cifrada</small></article>
      <article className="settings-summary-card"><span>PDFs legales vigentes</span><strong>{activeLegalDocuments}</strong><small>Versionados y privados</small></article>
    </section>

    <nav className="settings-tabs" aria-label="Secciones de ajustes">{tabs.map((tab) => <button key={tab.id} type="button" className={`settings-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => { setActiveTab(tab.id); setMessage(null); setError(null); window.history.replaceState(null, "", tab.id === "general" ? "/ajustes" : `/ajustes?tab=${tab.id}`); }}>{tab.label}</button>)}</nav>

    {activeTab === "users" ? <UserManagementPanel canManage={isAdmin} /> : null}
    {activeTab === "legal" ? <LegalDocumentsPanel initialDocuments={legalDocuments} canManage={isAdmin} /> : null}

    {activeTab !== "users" && activeTab !== "legal" ? <section className="settings-section">
      <div className="settings-section-header"><div><span className="eyebrow">Panel de control</span><h2>{activeDefinition.label}</h2><p>{activeDefinition.description}</p></div>{activeTab !== "integrations" && isAdmin && activeSettings.some((setting) => setting.editable) ? <button className="btn secondary" type="button" onClick={resetActiveTab} disabled={busy}>Restaurar valores de esta sección</button> : null}</div>
      {activeTab === "appearance" ? <div className="settings-preview" style={previewStyle}><aside className="settings-preview-sidebar"><strong>{String(draftValues["company.name"] || "Routsify")}</strong><span>Inicio</span><span>Clientes</span><span>Expedientes</span><span>Presupuestos</span></aside><div className="settings-preview-main"><span className="eyebrow">Vista previa inmediata</span><h2>Así se aplicará el estilo</h2><p>Los cambios visuales se muestran antes de guardar y se propagan al sistema al confirmar.</p><article className="settings-preview-card"><strong>Tarjeta de ejemplo</strong><p>Colores, fondos, radios, densidad y ancho del menú.</p><span className="settings-preview-button">Acción principal</span></article></div></div> : null}
      {activeTab === "appearance" ? <div className="settings-fields"><BrandLogoPanel initialUrl={typeof storedLogoUrl === "string" ? storedLogoUrl : ""} initialPath={typeof storedLogoPath === "string" ? storedLogoPath : ""} canManage={isAdmin} /></div> : null}
      {activeTab !== "integrations" && activeSettings.length ? <div className="settings-fields">{activeSettings.map(renderField)}</div> : null}
      {activeTab === "integrations" ? <IntegrationSecretsPanel initialStatuses={secretStatuses} initialValues={initialValues} canManage={canManageSecrets} onSettingsSaved={syncIntegrationSettings} /> : null}
    </section> : null}

    {activeTab !== "users" && activeTab !== "legal" && activeTab !== "integrations" && isAdmin ? <div className="settings-savebar"><div><strong>{dirtyKeys.length ? `${dirtyKeys.length} cambios sin guardar` : "Todos los ajustes están guardados"}</strong><p>{dirtyKeys.length ? "Los cambios no afectarán al sistema hasta pulsar Guardar." : "La configuración efectiva coincide con la pantalla."}</p></div><button className="btn" type="button" onClick={() => void saveChanges()} disabled={busy || !dirtyKeys.length}>{busy ? "Guardando..." : "Guardar y aplicar cambios"}</button></div> : null}
    {message ? <p className="client-message settings-feedback" role="status">{message}</p> : null}
    {error ? <p className="form-warning settings-feedback" role="alert">{error}</p> : null}
  </div>;
}
