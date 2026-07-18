"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./IntegrationSecretsPanel.module.css";

const secretDefinitions = {
  holded_api_key: { title: "API Key de Holded", placeholder: "Pega aquí la API Key de Holded" },
  openai_api_key: { title: "API Key de OpenAI", placeholder: "Pega aquí la API Key de OpenAI" },
  fillout_webhook_secret: { title: "Token de Fillout", placeholder: "Token Bearer del webhook" },
  booking_webhook_secret: { title: "Secreto del webhook de Booking", placeholder: "Secreto HMAC del webhook" },
  booking_api_key: { title: "API Key de Routsify Booking", placeholder: "Pega aquí la API Key de call.routsify.com" },
  smtp_username: { title: "Usuario SMTP", placeholder: "nombre@tudominio.com" },
  smtp_password: { title: "Contraseña SMTP", placeholder: "Contraseña del buzón" },
  whatsapp_access_token: { title: "Access token de WhatsApp", placeholder: "Token permanente de Meta" },
  whatsapp_verify_token: { title: "Verify token de WhatsApp", placeholder: "Token de verificación" },
  whatsapp_app_secret: { title: "App secret de WhatsApp", placeholder: "App secret de Meta Developers" },
} as const;

type SecretKey = keyof typeof secretDefinitions;
type ToolId = "holded" | "email" | "whatsapp" | "fillout" | "booking" | "openai";

export type IntegrationSecretStatus = { key: SecretKey; configured: boolean; updatedAt: string | null };
type TestResult = { ok?: boolean; data?: unknown; error?: string } | null;
type IntegrationSettingValue = string | number | boolean | string[] | Record<string, unknown>;

type IntegrationConfig = {
  email: { enabled: boolean; smtpHost: string; smtpPort: number; smtpSecure: boolean; fromName: string; fromAddress: string; replyTo: string };
  whatsapp: { enabled: boolean; graphVersion: string; phoneNumberId: string; businessAccountId: string };
  booking: {
    enabled: boolean;
    baseUrl: string;
    publicBookingUrl: string;
    authMode: "x_api_key" | "bearer";
    availabilityPath: string;
    bookingsPath: string;
    bookingPathTemplate: string;
    defaultTimezone: string;
    defaultDurationMinutes: number;
  };
};

type SimpleSettings = {
  filloutEnabled: boolean;
  filloutFormId: string;
  filloutPublicUrl: string;
  filloutSourceLabel: string;
  bookingWebhookEnabled: boolean;
  bookingSourceLabel: string;
};

const emptyConfig: IntegrationConfig = {
  email: { enabled: false, smtpHost: "smtp.hostinger.com", smtpPort: 465, smtpSecure: true, fromName: "Routsify", fromAddress: "", replyTo: "" },
  whatsapp: { enabled: false, graphVersion: "v23.0", phoneNumberId: "", businessAccountId: "" },
  booking: {
    enabled: false,
    baseUrl: "https://call.routsify.com/wp-json/routsify/v1",
    publicBookingUrl: "https://call.routsify.com",
    authMode: "x_api_key",
    availabilityPath: "/availability",
    bookingsPath: "/bookings",
    bookingPathTemplate: "/bookings/{id}",
    defaultTimezone: "Europe/Madrid",
    defaultDurationMinutes: 30,
  },
};

const tools: Array<{ id: ToolId; name: string; short: string; description: string }> = [
  { id: "holded", name: "Holded", short: "H", description: "Contactos, presupuestos, facturas, compras y pagos." },
  { id: "email", name: "Hostinger Mail", short: "@", description: "Envío de correos desde el buzón corporativo." },
  { id: "whatsapp", name: "WhatsApp Business", short: "W", description: "Mensajes y seguimiento mediante Meta Cloud API." },
  { id: "fillout", name: "Fillout", short: "F", description: "Solicitudes de viaje y formularios previos a la llamada." },
  { id: "booking", name: "Routsify Booking", short: "B", description: "Enlaces, disponibilidad, reserva y modificación de llamadas." },
  { id: "openai", name: "OpenAI OCR", short: "AI", description: "Lectura asistida de DNI y pasaportes con revisión humana." },
];

const toolSecrets: Record<ToolId, SecretKey[]> = {
  holded: ["holded_api_key"],
  email: ["smtp_username", "smtp_password"],
  whatsapp: ["whatsapp_access_token", "whatsapp_verify_token", "whatsapp_app_secret"],
  fillout: ["fillout_webhook_secret"],
  booking: ["booking_api_key", "booking_webhook_secret"],
  openai: ["openai_api_key"],
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function resultText(result: TestResult) {
  if (!result) return null;
  if (result.ok) {
    const data = result.data as Record<string, unknown> | undefined;
    if (data?.modules && typeof data.modules === "object") {
      const modules = Object.entries(data.modules as Record<string, { ok?: boolean }>).map(([key, value]) => `${key}: ${value.ok ? "OK" : "no disponible"}`).join(" · ");
      return `Conexión realizada. ${modules}`;
    }
    if (Array.isArray(data?.routes)) return `Conexión realizada. La API publica ${data.routes.length} rutas.`;
    return "Conexión realizada correctamente.";
  }
  return `No se pudo validar: ${result.error || "revisa la credencial y los permisos"}.`;
}

export function IntegrationSecretsPanel({
  initialStatuses,
  initialValues,
  canManage,
  onSettingsSaved,
}: {
  initialStatuses: IntegrationSecretStatus[];
  initialValues: Record<string, IntegrationSettingValue>;
  canManage: boolean;
  onSettingsSaved?: (updates: Record<string, IntegrationSettingValue>) => void;
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [secretValues, setSecretValues] = useState<Record<SecretKey, string>>({
    holded_api_key: "",
    openai_api_key: "",
    fillout_webhook_secret: "",
    booking_webhook_secret: "",
    booking_api_key: "",
    smtp_username: "",
    smtp_password: "",
    whatsapp_access_token: "",
    whatsapp_verify_token: "",
    whatsapp_app_secret: "",
  });
  const [config, setConfig] = useState<IntegrationConfig>(emptyConfig);
  const [simple, setSimple] = useState<SimpleSettings>({
    filloutEnabled: initialValues["integrations.fillout.enabled"] === true,
    filloutFormId: stringValue(initialValues["integrations.fillout.form_id"]),
    filloutPublicUrl: stringValue(initialValues["integrations.fillout.public_url"]),
    filloutSourceLabel: stringValue(initialValues["integrations.fillout.source_label"], "Fillout"),
    bookingWebhookEnabled: initialValues["integrations.booking.enabled"] === true,
    bookingSourceLabel: stringValue(initialValues["integrations.booking.source_label"], "Routsify Booking"),
  });
  const [credentialEnabled, setCredentialEnabled] = useState({
    holded: initialStatuses.some((item) => item.key === "holded_api_key" && item.configured),
    openai: initialStatuses.some((item) => item.key === "openai_api_key" && item.configured),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string | null>>({});
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);

  const statusMap = useMemo(() => new Map(statuses.map((item) => [item.key, item])), [statuses]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void fetch("/api/routsify/settings/integrations/config")
      .then((response) => response.json())
      .then((result) => {
        if (result?.ok && result.data) setConfig(result.data as IntegrationConfig);
        else setMessages((current) => ({ ...current, global: String(result?.error || "No se pudo cargar la configuración de integraciones.") }));
      })
      .catch(() => setMessages((current) => ({ ...current, global: "No se pudo cargar la configuración de integraciones." })))
      .finally(() => setLoading(false));
  }, []);

  function hasSecret(key: SecretKey) {
    return Boolean(statusMap.get(key)?.configured || secretValues[key].trim());
  }

  function isActive(tool: ToolId) {
    if (tool === "holded") return credentialEnabled.holded;
    if (tool === "openai") return credentialEnabled.openai;
    if (tool === "email") return config.email.enabled;
    if (tool === "whatsapp") return config.whatsapp.enabled;
    if (tool === "fillout") return simple.filloutEnabled;
    return config.booking.enabled;
  }

  function isReady(tool: ToolId) {
    if (!isActive(tool)) return false;
    if (tool === "holded") return hasSecret("holded_api_key");
    if (tool === "openai") return hasSecret("openai_api_key");
    if (tool === "email") return Boolean(config.email.fromAddress && hasSecret("smtp_password"));
    if (tool === "whatsapp") return Boolean(config.whatsapp.phoneNumberId && hasSecret("whatsapp_access_token"));
    if (tool === "fillout") return hasSecret("fillout_webhook_secret");
    return Boolean(config.booking.publicBookingUrl && hasSecret("booking_api_key"));
  }

  function setToolActive(tool: ToolId, enabled: boolean) {
    setMessages((current) => ({ ...current, [tool]: null }));
    setTests((current) => ({ ...current, [tool]: null }));
    if (tool === "holded") return setCredentialEnabled((current) => ({ ...current, holded: enabled }));
    if (tool === "openai") return setCredentialEnabled((current) => ({ ...current, openai: enabled }));
    if (tool === "email") return setConfig((current) => ({ ...current, email: { ...current.email, enabled } }));
    if (tool === "whatsapp") return setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, enabled } }));
    if (tool === "fillout") return setSimple((current) => ({ ...current, filloutEnabled: enabled }));
    setConfig((current) => ({ ...current, booking: { ...current.booking, enabled } }));
    setSimple((current) => ({ ...current, bookingWebhookEnabled: enabled }));
  }

  function updateSecretStatus(key: SecretKey, configured: boolean) {
    setStatuses((current) => {
      const next = { key, configured, updatedAt: configured ? new Date().toISOString() : null };
      return current.some((item) => item.key === key) ? current.map((item) => item.key === key ? next : item) : [...current, next];
    });
  }

  async function saveSecret(key: SecretKey, explicitValue?: string) {
    const value = (explicitValue ?? secretValues[key]).trim();
    if (!value) return;
    const response = await fetch(`/api/routsify/settings/secrets/${key}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(String(result?.error || `No se pudo guardar ${secretDefinitions[key].title}.`));
    updateSecretStatus(key, true);
    setSecretValues((current) => ({ ...current, [key]: "" }));
  }

  async function deleteSecret(key: SecretKey) {
    if (!statusMap.get(key)?.configured) return;
    const response = await fetch(`/api/routsify/settings/secrets/${key}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(String(result?.error || `No se pudo desactivar ${secretDefinitions[key].title}.`));
    updateSecretStatus(key, false);
  }

  async function saveProviderConfig(patch: Partial<IntegrationConfig>) {
    const response = await fetch("/api/routsify/settings/integrations/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(String(result?.error || "No se pudo guardar la configuración."));
    setConfig(result.data as IntegrationConfig);
  }

  async function saveSimpleSettings(updates: Record<string, IntegrationSettingValue>) {
    const response = await fetch("/api/routsify/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: Object.entries(updates).map(([key, value]) => ({ key, value })) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(String(result?.error || "No se pudieron guardar los ajustes."));
    onSettingsSaved?.(updates);
  }

  function validateTool(tool: ToolId) {
    if (!isActive(tool)) return null;
    if (tool === "holded" && !hasSecret("holded_api_key")) return "Pega la API Key de Holded antes de activar la conexión.";
    if (tool === "openai" && !hasSecret("openai_api_key")) return "Pega la API Key de OpenAI antes de activar OCR.";
    if (tool === "email" && !config.email.fromAddress.trim()) return "Indica el correo remitente.";
    if (tool === "email" && !hasSecret("smtp_password")) return "Indica la contraseña SMTP del buzón.";
    if (tool === "whatsapp" && !config.whatsapp.phoneNumberId.trim()) return "Indica el Phone Number ID de WhatsApp.";
    if (tool === "whatsapp" && !hasSecret("whatsapp_access_token")) return "Pega el access token de Meta.";
    if (tool === "fillout" && !hasSecret("fillout_webhook_secret")) return "Crea o pega el token del webhook de Fillout.";
    if (tool === "booking" && !config.booking.publicBookingUrl.trim()) return "Indica la URL pública de reservas.";
    if (tool === "booking" && !hasSecret("booking_api_key")) return "Pega la API Key de Routsify Booking.";
    return null;
  }

  async function saveTool(tool: ToolId) {
    if (!canManage) return;
    const validationError = validateTool(tool);
    if (validationError) return setMessages((current) => ({ ...current, [tool]: validationError }));
    setBusy(`save:${tool}`);
    setMessages((current) => ({ ...current, [tool]: null }));
    setTests((current) => ({ ...current, [tool]: null }));
    try {
      if ((tool === "holded" || tool === "openai") && !isActive(tool)) {
        await deleteSecret(tool === "holded" ? "holded_api_key" : "openai_api_key");
      } else {
        if (tool === "email" && isActive(tool)) await saveSecret("smtp_username", config.email.fromAddress);
        for (const key of toolSecrets[tool]) {
          if (key === "smtp_username") continue;
          if (secretValues[key].trim()) await saveSecret(key);
        }
      }

      if (tool === "email") await saveProviderConfig({ email: config.email });
      if (tool === "whatsapp") await saveProviderConfig({ whatsapp: config.whatsapp });
      if (tool === "booking") {
        await saveProviderConfig({ booking: config.booking });
        await saveSimpleSettings({
          "integrations.booking.enabled": simple.bookingWebhookEnabled,
          "integrations.booking.source_label": simple.bookingSourceLabel,
        });
      }
      if (tool === "fillout") {
        await saveSimpleSettings({
          "integrations.fillout.enabled": simple.filloutEnabled,
          "integrations.fillout.form_id": simple.filloutFormId,
          "integrations.fillout.public_url": simple.filloutPublicUrl,
          "integrations.fillout.source_label": simple.filloutSourceLabel,
        });
      }

      setMessages((current) => ({ ...current, [tool]: isActive(tool) ? "Configuración guardada." : "Integración desactivada." }));
    } catch (error) {
      setMessages((current) => ({ ...current, [tool]: error instanceof Error ? error.message : "No se pudo guardar la integración." }));
    } finally {
      setBusy(null);
    }
  }

  async function testTool(tool: ToolId) {
    if (!canManage || !isReady(tool)) return;
    setBusy(`test:${tool}`);
    setTests((current) => ({ ...current, [tool]: null }));
    const response = await fetch(`/api/routsify/settings/integrations/${tool}/test`, { method: "POST" });
    const result = await response.json().catch(() => null);
    setBusy(null);
    setTests((current) => ({ ...current, [tool]: result || { ok: false, error: "Respuesta inválida" } }));
  }

  async function copyWebhook(path: string, tool: ToolId) {
    if (!origin) return;
    await navigator.clipboard.writeText(`${origin}${path}`);
    setMessages((current) => ({ ...current, [tool]: "URL del webhook copiada." }));
  }

  function secretInput(key: SecretKey, label = secretDefinitions[key].title) {
    return <label className={styles.field}>
      <span>{label}</span>
      <input className="input" type="password" autoComplete="new-password" placeholder={statusMap.get(key)?.configured ? "Configurada · escribe solo para sustituirla" : secretDefinitions[key].placeholder} value={secretValues[key]} onChange={(event) => setSecretValues((current) => ({ ...current, [key]: event.target.value }))} disabled={!canManage || busy !== null} />
    </label>;
  }

  function webhookEndpoint(path: string, tool: ToolId) {
    return <div className={styles.endpoint}>
      <span>Webhook</span>
      <code>{origin ? `${origin}${path}` : path}</code>
      <button className="btn secondary" type="button" onClick={() => void copyWebhook(path, tool)}>Copiar URL</button>
    </div>;
  }

  function mainFields(tool: ToolId) {
    if (tool === "holded") return secretInput("holded_api_key", "API Key");
    if (tool === "openai") return secretInput("openai_api_key", "API Key");
    if (tool === "email") return <>
      <label className={styles.field}><span>Correo remitente</span><input className="input" type="email" value={config.email.fromAddress} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, fromAddress: event.target.value } }))} disabled={!canManage || busy !== null} placeholder="reservas@routsify.com" /></label>
      {secretInput("smtp_password", "Contraseña del correo")}
      <label className={styles.field}><span>Nombre del remitente</span><input className="input" value={config.email.fromName} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, fromName: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
    </>;
    if (tool === "whatsapp") return <>
      <label className={styles.field}><span>Phone Number ID</span><input className="input" inputMode="numeric" value={config.whatsapp.phoneNumberId} onChange={(event) => setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, phoneNumberId: event.target.value } }))} disabled={!canManage || busy !== null} placeholder="ID numérico de Meta" /></label>
      {secretInput("whatsapp_access_token", "Access token")}
    </>;
    if (tool === "fillout") return <>
      <label className={styles.field}><span>URL pública del formulario</span><input className="input" type="url" value={simple.filloutPublicUrl} onChange={(event) => setSimple((current) => ({ ...current, filloutPublicUrl: event.target.value }))} disabled={!canManage || busy !== null} placeholder="https://form.fillout.com/..." /></label>
      {secretInput("fillout_webhook_secret", "Token del webhook")}
    </>;
    return <>
      <label className={styles.field}><span>URL pública de reservas</span><input className="input" type="url" value={config.booking.publicBookingUrl} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, publicBookingUrl: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      {secretInput("booking_api_key", "API Key")}
    </>;
  }

  function advancedFields(tool: ToolId) {
    if (tool === "email") return <div className={styles.advancedGrid}>
      <label className={styles.field}><span>Servidor SMTP</span><input className="input" value={config.email.smtpHost} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, smtpHost: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Puerto</span><input className="input" type="number" value={config.email.smtpPort} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, smtpPort: Number(event.target.value) } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Reply-To</span><input className="input" type="email" value={config.email.replyTo} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, replyTo: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.checkField}><input type="checkbox" checked={config.email.smtpSecure} onChange={(event) => setConfig((current) => ({ ...current, email: { ...current.email, smtpSecure: event.target.checked } }))} disabled={!canManage || busy !== null} /><span>Conexión SMTP segura</span></label>
    </div>;
    if (tool === "whatsapp") return <div className={styles.advancedGrid}>
      <label className={styles.field}><span>WhatsApp Business Account ID</span><input className="input" inputMode="numeric" value={config.whatsapp.businessAccountId} onChange={(event) => setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, businessAccountId: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Versión Graph API</span><input className="input" value={config.whatsapp.graphVersion} onChange={(event) => setConfig((current) => ({ ...current, whatsapp: { ...current.whatsapp, graphVersion: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      {secretInput("whatsapp_verify_token", "Verify token")}
      {secretInput("whatsapp_app_secret", "App secret")}
      {webhookEndpoint("/api/webhooks/whatsapp", tool)}
    </div>;
    if (tool === "fillout") return <div className={styles.advancedGrid}>
      <label className={styles.field}><span>ID del formulario</span><input className="input" value={simple.filloutFormId} onChange={(event) => setSimple((current) => ({ ...current, filloutFormId: event.target.value }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Nombre del origen</span><input className="input" value={simple.filloutSourceLabel} onChange={(event) => setSimple((current) => ({ ...current, filloutSourceLabel: event.target.value }))} disabled={!canManage || busy !== null} /></label>
      {webhookEndpoint("/api/webhooks/forms", tool)}
    </div>;
    if (tool === "booking") return <div className={styles.advancedGrid}>
      <label className={styles.field}><span>Base API</span><input className="input" type="url" value={config.booking.baseUrl} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, baseUrl: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Autenticación</span><select value={config.booking.authMode} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, authMode: event.target.value as IntegrationConfig["booking"]["authMode"] } }))} disabled={!canManage || busy !== null}><option value="x_api_key">X-Routsify-API-Key</option><option value="bearer">Authorization Bearer</option></select></label>
      <label className={styles.field}><span>Ruta de disponibilidad</span><input className="input" value={config.booking.availabilityPath} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, availabilityPath: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Ruta de reservas</span><input className="input" value={config.booking.bookingsPath} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, bookingsPath: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Ruta de reserva individual</span><input className="input" value={config.booking.bookingPathTemplate} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, bookingPathTemplate: event.target.value } }))} disabled={!canManage || busy !== null} /><small>Debe contener {"{id}"}.</small></label>
      <label className={styles.field}><span>Zona horaria</span><input className="input" value={config.booking.defaultTimezone} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, defaultTimezone: event.target.value } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Duración predeterminada</span><input className="input" type="number" min={5} max={240} value={config.booking.defaultDurationMinutes} onChange={(event) => setConfig((current) => ({ ...current, booking: { ...current.booking, defaultDurationMinutes: Number(event.target.value) } }))} disabled={!canManage || busy !== null} /></label>
      <label className={styles.field}><span>Nombre del origen</span><input className="input" value={simple.bookingSourceLabel} onChange={(event) => setSimple((current) => ({ ...current, bookingSourceLabel: event.target.value }))} disabled={!canManage || busy !== null} /></label>
      {secretInput("booking_webhook_secret", "Secreto del webhook")}
      {webhookEndpoint("/api/webhooks/bookings", tool)}
    </div>;
    return null;
  }

  const activeCount = tools.filter((tool) => isActive(tool.id)).length;
  const readyCount = tools.filter((tool) => isReady(tool.id)).length;

  return <section className={styles.wrapper}>
    <div className={styles.intro}>
      <div><span className="eyebrow">Conexiones</span><h2>Herramientas conectadas</h2><p>Activa cada herramienta, completa únicamente los datos esenciales y prueba la conexión.</p></div>
      <div className={styles.summary}><strong>{readyCount}/{tools.length}</strong><span>listas</span><small>{activeCount} activas</small></div>
    </div>

    {!canManage ? <p className="form-warning">Puedes consultar el estado, pero solo un administrador puede cambiar credenciales o conexiones.</p> : null}
    {messages.global ? <p className="form-warning">{messages.global}</p> : null}

    <div className={styles.grid} aria-busy={loading}>
      {tools.map((tool) => {
        const active = isActive(tool.id);
        const ready = isReady(tool.id);
        const result = tests[tool.id];
        const message = messages[tool.id];
        const credentialWillBeRemoved = (tool.id === "holded" || tool.id === "openai") && !active && toolSecrets[tool.id].some((key) => statusMap.get(key)?.configured);
        return <article className={`${styles.card} ${active ? styles.cardActive : ""}`} key={tool.id}>
          <div className={styles.cardHeader}>
            <div className={styles.identity}><span className={styles.logo}>{tool.short}</span><div><h3>{tool.name}</h3><p>{tool.description}</p></div></div>
            <div className={styles.stateBlock}>
              <label className={styles.toggle}><input type="checkbox" checked={active} onChange={(event) => setToolActive(tool.id, event.target.checked)} disabled={!canManage || busy !== null || loading} /><span>{active ? "Activada" : "Desactivada"}</span></label>
              <span className={`${styles.status} ${ready ? styles.statusReady : active ? styles.statusPending : styles.statusOff}`}>{ready ? "✓ Activa" : active ? "Falta configurar" : "Desactivada"}</span>
            </div>
          </div>

          <div className={styles.mainFields}>{mainFields(tool.id)}</div>
          <p className={styles.secretHelp}>Las claves guardadas permanecen cifradas y nunca vuelven a mostrarse.</p>
          {credentialWillBeRemoved ? <p className={styles.warning}>Al guardar desactivada se eliminará la API Key almacenada.</p> : null}

          {advancedFields(tool.id) ? <details className={styles.advanced}><summary>Configuración avanzada</summary>{advancedFields(tool.id)}</details> : null}

          <div className={styles.actions}>
            <button className="btn" type="button" onClick={() => void saveTool(tool.id)} disabled={!canManage || busy !== null || loading}>{busy === `save:${tool.id}` ? "Guardando..." : "Guardar"}</button>
            <button className="btn secondary" type="button" onClick={() => void testTool(tool.id)} disabled={!canManage || !ready || busy !== null || loading}>{busy === `test:${tool.id}` ? "Probando..." : "Probar conexión"}</button>
          </div>
          {message ? <p className={message.toLowerCase().includes("no se pudo") || message.toLowerCase().includes("indica") || message.toLowerCase().includes("pega") || message.toLowerCase().includes("error") ? "form-warning" : "client-message"} role="status">{message}</p> : null}
          {resultText(result) ? <p className={result?.ok ? "client-message" : "form-warning"} role="status">{resultText(result)}</p> : null}
        </article>;
      })}
    </div>
  </section>;
}
