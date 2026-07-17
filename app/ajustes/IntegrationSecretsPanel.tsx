"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const definitions = {
  holded_api_key: { title: "Holded", description: "Sincroniza contactos, presupuestos, proformas, facturas, compras y pagos.", integration: "holded", placeholder: "Pega aquí la API key de Holded" },
  openai_api_key: { title: "OpenAI OCR", description: "Extrae datos de DNI y pasaportes con revisión humana obligatoria.", integration: "openai", placeholder: "Pega aquí la API key de OpenAI" },
  fillout_webhook_secret: { title: "Fillout · token del webhook", description: "Token Bearer estático para autenticar las entregas de Fillout.", webhookPath: "/api/webhooks/forms", placeholder: "Crea un secreto aleatorio de al menos 12 caracteres" },
  booking_webhook_secret: { title: "Routsify Booking · secreto HMAC", description: "Protege altas, cambios y cancelaciones de reservas de llamada.", webhookPath: "/api/webhooks/bookings", placeholder: "Crea un secreto HMAC de al menos 12 caracteres" },
  smtp_username: { title: "Hostinger Mail · usuario SMTP", description: "Dirección completa del buzón que enviará los correos.", placeholder: "nombre@tudominio.com" },
  smtp_password: { title: "Hostinger Mail · contraseña SMTP", description: "Contraseña del buzón de envío. Se almacena cifrada.", integration: "email", placeholder: "Contraseña del buzón" },
  whatsapp_access_token: { title: "Meta WhatsApp · access token", description: "Token de usuario del sistema con permisos de WhatsApp Business.", integration: "whatsapp", placeholder: "Token permanente de Meta" },
  whatsapp_verify_token: { title: "Meta WhatsApp · verify token", description: "Cadena que eliges para validar el callback del webhook.", webhookPath: "/api/webhooks/whatsapp", placeholder: "Token de verificación elegido por ti" },
  whatsapp_app_secret: { title: "Meta WhatsApp · app secret", description: "Se usa para validar x-hub-signature-256 en cada evento entrante.", webhookPath: "/api/webhooks/whatsapp", placeholder: "App secret de Meta Developers" },
} as const;

type SecretKey = keyof typeof definitions;
export type IntegrationSecretStatus = { key: SecretKey; configured: boolean; updatedAt: string | null };
type TestResult = { ok?: boolean; data?: unknown; error?: string } | null;
type IntegrationConfig = {
  email: { enabled: boolean; smtpHost: string; smtpPort: number; smtpSecure: boolean; fromName: string; fromAddress: string; replyTo: string };
  whatsapp: { enabled: boolean; graphVersion: string; phoneNumberId: string; businessAccountId: string };
};

const emptyConfig: IntegrationConfig = {
  email: { enabled: false, smtpHost: "smtp.hostinger.com", smtpPort: 465, smtpSecure: true, fromName: "Routsify", fromAddress: "", replyTo: "" },
  whatsapp: { enabled: false, graphVersion: "v23.0", phoneNumberId: "", businessAccountId: "" },
};

function resultText(result: TestResult) {
  if (!result) return null;
  if (result.ok) {
    const data = result.data as Record<string, unknown> | undefined;
    if (data?.modules && typeof data.modules === "object") {
      const modules = Object.entries(data.modules as Record<string, { ok?: boolean }>).map(([key, value]) => `${key}: ${value.ok ? "OK" : "no disponible"}`).join(" · ");
      return `Conexión realizada. ${modules}`;
    }
    return "Conexión realizada correctamente.";
  }
  return `No se pudo validar: ${result.error || "revisa la credencial, configuración y permisos"}.`;
}

export function IntegrationSecretsPanel({ initialStatuses, canManage }: { initialStatuses: IntegrationSecretStatus[]; canManage: boolean }) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [values, setValues] = useState<Record<SecretKey, string>>({ holded_api_key: "", openai_api_key: "", fillout_webhook_secret: "", booking_webhook_secret: "", smtp_username: "", smtp_password: "", whatsapp_access_token: "", whatsapp_verify_token: "", whatsapp_app_secret: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string | null>>({});
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [origin, setOrigin] = useState("");
  const [config, setConfig] = useState<IntegrationConfig>(emptyConfig);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const statusMap = useMemo(() => new Map(statuses.map((item) => [item.key, item])), [statuses]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void fetch("/api/routsify/settings/integrations/config").then((response) => response.json()).then((result) => { if (result?.ok && result.data) setConfig(result.data as IntegrationConfig); }).catch(() => null);
  }, []);

  async function save(event: FormEvent<HTMLFormElement>, key: SecretKey) {
    event.preventDefault();
    if (!canManage) return;
    const value = values[key].trim();
    if (!value) return setMessages((current) => ({ ...current, [key]: "Introduce una clave antes de guardar." }));
    setBusy(key); setMessages((current) => ({ ...current, [key]: null })); setTests((current) => ({ ...current, [key]: null }));
    const response = await fetch(`/api/routsify/settings/secrets/${key}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }) });
    const result = await response.json().catch(() => null); setBusy(null);
    if (!response.ok || !result?.ok) return setMessages((current) => ({ ...current, [key]: String(result?.error || "No se pudo guardar la clave.") }));
    setValues((current) => ({ ...current, [key]: "" }));
    setStatuses((current) => current.map((item) => item.key === key ? { ...item, configured: true, updatedAt: new Date().toISOString() } : item));
    setMessages((current) => ({ ...current, [key]: "Clave guardada de forma cifrada. Nunca volverá a mostrarse." }));
  }

  async function test(key: SecretKey) {
    const definition = definitions[key];
    if (!("integration" in definition) || !canManage || !statusMap.get(key)?.configured) return;
    setBusy(`test:${key}`); setTests((current) => ({ ...current, [key]: null }));
    const response = await fetch(`/api/routsify/settings/integrations/${definition.integration}/test`, { method: "POST" });
    const result = await response.json().catch(() => null); setBusy(null);
    setTests((current) => ({ ...current, [key]: result || { ok: false, error: "Respuesta inválida" } }));
  }

  async function remove(key: SecretKey) {
    if (!canManage || !statusMap.get(key)?.configured || !window.confirm(`¿Eliminar la credencial de ${definitions[key].title}?`)) return;
    setBusy(`delete:${key}`);
    const response = await fetch(`/api/routsify/settings/secrets/${key}`, { method: "DELETE" });
    const result = await response.json().catch(() => null); setBusy(null);
    if (!response.ok || !result?.ok) return setMessages((current) => ({ ...current, [key]: String(result?.error || "No se pudo eliminar.") }));
    setStatuses((current) => current.map((item) => item.key === key ? { ...item, configured: false, updatedAt: null } : item));
    setTests((current) => ({ ...current, [key]: null }));
    setMessages((current) => ({ ...current, [key]: "Credencial eliminada." }));
  }

  async function copyWebhook(key: SecretKey) {
    const definition = definitions[key];
    if (!("webhookPath" in definition) || !origin) return;
    await navigator.clipboard.writeText(`${origin}${definition.webhookPath}`);
    setMessages((current) => ({ ...current, [key]: "URL del webhook copiada." }));
  }

  async function saveConfig() {
    if (!canManage) return;
    setBusy("config"); setConfigMessage(null);
    const response = await fetch("/api/routsify/settings/integrations/config", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(config) });
    const result = await response.json().catch(() => null); setBusy(null);
    if (!response.ok || !result?.ok) return setConfigMessage(String(result?.error || "No se pudo guardar la configuración."));
    setConfig(result.data as IntegrationConfig); setConfigMessage("Configuración de proveedores guardada.");
  }

  return <section className="card settings-secret-panel">
    <div className="panel-head"><div><h2>Credenciales e integraciones</h2><p>Se guardan en Supabase Vault, cifradas por organización. El navegador nunca recibe una clave ya almacenada.</p></div><span className="badge">Solo administrador</span></div>
    {!canManage ? <p className="form-warning">Tu rol puede consultar el estado, pero solo un administrador puede guardar o probar credenciales.</p> : null}

    <div className="settings-fields">
      <article className="setting-field"><div className="setting-field-head"><div><strong>Hostinger Mail por SMTP</strong><p>Usa SSL en smtp.hostinger.com:465. La dirección remitente debe pertenecer al buzón autenticado.</p></div></div><div className="settings-secret-grid">
        <label>Activar email<input type="checkbox" checked={config.email.enabled} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, enabled: event.target.checked } }))} disabled={!canManage} /></label>
        <label>Servidor SMTP<input className="input" value={config.email.smtpHost} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, smtpHost: event.target.value } }))} disabled={!canManage} /></label>
        <label>Puerto<input className="input" type="number" value={config.email.smtpPort} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, smtpPort: Number(event.target.value) } }))} disabled={!canManage} /></label>
        <label>Nombre remitente<input className="input" value={config.email.fromName} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, fromName: event.target.value } }))} disabled={!canManage} /></label>
        <label>Email remitente<input className="input" type="email" value={config.email.fromAddress} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, fromAddress: event.target.value } }))} disabled={!canManage} /></label>
        <label>Reply-To<input className="input" type="email" value={config.email.replyTo} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, replyTo: event.target.value } }))} disabled={!canManage} /></label>
      </div></article>
      <article className="setting-field"><div className="setting-field-head"><div><strong>WhatsApp Business Cloud API</strong><p>Configura la versión de Graph, Phone Number ID y WABA ID desde Meta Developers / WhatsApp Manager.</p></div></div><div className="settings-secret-grid">
        <label>Activar WhatsApp<input type="checkbox" checked={config.whatsapp.enabled} onChange={(event) => setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, enabled: event.target.checked } }))} disabled={!canManage} /></label>
        <label>Versión Graph API<input className="input" value={config.whatsapp.graphVersion} onChange={(event) => setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, graphVersion: event.target.value } }))} disabled={!canManage} /></label>
        <label>Phone Number ID<input className="input" value={config.whatsapp.phoneNumberId} onChange={(event) => setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, phoneNumberId: event.target.value } }))} disabled={!canManage} /></label>
        <label>WhatsApp Business Account ID<input className="input" value={config.whatsapp.businessAccountId} onChange={(event) => setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, businessAccountId: event.target.value } }))} disabled={!canManage} /></label>
      </div></article>
    </div>
    {canManage ? <button className="btn" type="button" disabled={busy !== null} onClick={() => void saveConfig()}>{busy === "config" ? "Guardando..." : "Guardar configuración de proveedores"}</button> : null}
    {configMessage ? <p className="client-message" role="status">{configMessage}</p> : null}

    <div className="settings-secret-grid">
      {(Object.keys(definitions) as SecretKey[]).map((key) => {
        const definition = definitions[key]; const status = statusMap.get(key); const configured = Boolean(status?.configured);
        const webhookUrl = "webhookPath" in definition && origin ? `${origin}${definition.webhookPath}` : null;
        const fillout = key === "fillout_webhook_secret";
        const whatsappWebhook = key === "whatsapp_verify_token" || key === "whatsapp_app_secret";
        return <article className="integration-card" key={key}>
          <div className="section-heading"><div><h3>{definition.title}</h3><p>{definition.description}</p></div><span className={`status-pill ${configured ? "status-success" : "status-warning"}`}>{configured ? "Configurada" : "Pendiente"}</span></div>
          {webhookUrl ? <div className="integration-endpoint"><span>Webhook</span><code>{webhookUrl}</code><button className="btn secondary" type="button" onClick={() => void copyWebhook(key)}>Copiar URL</button><small>{fillout ? "En Fillout añade Authorization: Bearer TU_SECRETO. No necesita calcular HMAC." : whatsappWebhook ? "Meta verificará el callback con el verify token y firmará los POST con el app secret." : "Firmar con HMAC SHA-256 y enviar x-routsify-signature, x-routsify-timestamp y x-routsify-event-id."}</small></div> : null}
          <form className="form" onSubmit={(event) => void save(event, key)}>
            <label>Nueva clave secreta<input className="input" type="password" autoComplete="new-password" placeholder={definition.placeholder} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} disabled={!canManage || busy !== null} /></label>
            <p className="field-help">{configured && status?.updatedAt ? `Última actualización: ${new Date(status.updatedAt).toLocaleString("es-ES")}.` : configured ? "Configurada mediante variable segura de producción." : "Todavía no hay una credencial guardada."}</p>
            <div className="form-actions"><button className="btn" type="submit" disabled={!canManage || busy !== null}>{busy === key ? "Guardando..." : configured ? "Sustituir clave" : "Guardar clave"}</button>{"integration" in definition ? <button className="btn secondary" type="button" onClick={() => void test(key)} disabled={!canManage || !configured || busy !== null}>{busy === `test:${key}` ? "Probando..." : "Probar conexión"}</button> : null}{configured ? <button className="link-button danger-text" type="button" onClick={() => void remove(key)} disabled={!canManage || busy !== null}>Eliminar</button> : null}</div>
          </form>
          {messages[key] ? <p className="client-message" role="status">{messages[key]}</p> : null}
          {resultText(tests[key]) ? <p className={tests[key]?.ok ? "client-message" : "form-warning"}>{resultText(tests[key])}</p> : null}
        </article>;
      })}
    </div>
  </section>;
}
