"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  canManage: boolean;
  initialEnabled: boolean;
  initialFormId: string;
  initialPublicUrl: string;
  initialSourceLabel: string;
  apiKeyConfigured: boolean;
};

type Result = { ok?: boolean; error?: string; data?: Record<string, unknown> } | null;

function extractFormId(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{6,}$/.test(raw) && !raw.includes(".")) return raw;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => part === "t" || part === "form");
    return marker >= 0 ? parts[marker + 1] || "" : parts.at(-1) || "";
  } catch {
    return "";
  }
}

export function FilloutSettingsClient(props: Props) {
  const [enabled, setEnabled] = useState(props.initialEnabled);
  const [publicUrl, setPublicUrl] = useState(props.initialPublicUrl);
  const [formId, setFormId] = useState(props.initialFormId || extractFormId(props.initialPublicUrl));
  const [sourceLabel, setSourceLabel] = useState(props.initialSourceLabel || "Fillout");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(props.apiKeyConfigured);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [test, setTest] = useState<Result>(null);
  const [sync, setSync] = useState<Result>(null);

  const effectiveFormId = useMemo(() => formId.trim() || extractFormId(publicUrl), [formId, publicUrl]);
  const ready = enabled && Boolean(effectiveFormId) && apiKeyConfigured;

  async function save() {
    if (!props.canManage) return;
    if (enabled && !publicUrl.trim()) return setMessage("Indica la URL pública del formulario.");
    if (enabled && !effectiveFormId) return setMessage("No se ha podido obtener el ID del formulario.");
    if (enabled && !apiKeyConfigured && !apiKey.trim()) return setMessage("Pega la API Key de Fillout antes de activar la conexión.");
    setBusy("save");
    setMessage(null);
    setTest(null);
    setSync(null);
    try {
      if (apiKey.trim()) {
        const secretResponse = await fetch("/api/routsify/settings/secrets/fillout_api_key", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: apiKey.trim() }),
        });
        const secretResult = await secretResponse.json().catch(() => null);
        if (!secretResponse.ok || !secretResult?.ok) throw new Error(String(secretResult?.error || "No se pudo guardar la API Key."));
        setApiKey("");
        setApiKeyConfigured(true);
      }
      const settingsResponse = await fetch("/api/routsify/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings: [
          { key: "integrations.fillout.enabled", value: enabled },
          { key: "integrations.fillout.form_id", value: effectiveFormId },
          { key: "integrations.fillout.public_url", value: publicUrl.trim() },
          { key: "integrations.fillout.source_label", value: sourceLabel.trim() || "Fillout" },
        ] }),
      });
      const settingsResult = await settingsResponse.json().catch(() => null);
      if (!settingsResponse.ok || !settingsResult?.ok) throw new Error(String(settingsResult?.error || "No se pudo guardar la configuración."));
      setFormId(effectiveFormId);
      setMessage(enabled ? "Configuración guardada. Ya puedes probar la conexión." : "Fillout se ha desactivado sin borrar la API Key.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar Fillout.");
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    if (!props.canManage || !ready) return;
    setBusy("test");
    setTest(null);
    try {
      const response = await fetch("/api/routsify/settings/integrations/fillout/test", { method: "POST" });
      const result = await response.json().catch(() => null);
      setTest(result || { ok: false, error: "Respuesta inválida" });
    } finally {
      setBusy(null);
    }
  }

  async function synchronize(full: boolean) {
    if (!props.canManage || !ready) return;
    setBusy(full ? "sync-full" : "sync");
    setSync(null);
    try {
      const response = await fetch("/api/routsify/settings/integrations/fillout/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full, maxPages: full ? 20 : 5 }),
      });
      const result = await response.json().catch(() => null);
      setSync(result || { ok: false, error: "Respuesta inválida" });
    } finally {
      setBusy(null);
    }
  }

  const testData = test?.data || {};
  const syncData = sync?.data || {};

  return <div style={{ display: "grid", gap: 18 }}>
    <section className="card" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>Fillout REST API</h2><p style={{ margin: "6px 0 0" }}>Importa respuestas del formulario en Cliente 360 y Leads. Nunca crea expedientes automáticamente.</p></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={!props.canManage || busy !== null} /> <strong>{enabled ? "Activada" : "Desactivada"}</strong></label>
      </div>

      <div className="form-grid">
        <label><span>URL pública del formulario</span><input className="input" type="url" value={publicUrl} onChange={(event) => { setPublicUrl(event.target.value); if (!formId.trim()) setFormId(extractFormId(event.target.value)); }} disabled={!props.canManage || busy !== null} placeholder="https://routsify.fillout.com/t/..." /></label>
        <label><span>API Key de Fillout</span><input className="input" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={!props.canManage || busy !== null} placeholder={apiKeyConfigured ? "Configurada · escribe solo para sustituirla" : "Pega aquí la API Key"} /></label>
        <label><span>ID del formulario</span><input className="input" value={effectiveFormId} onChange={(event) => setFormId(event.target.value)} disabled={!props.canManage || busy !== null} /></label>
        <label><span>Nombre del origen</span><input className="input" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} disabled={!props.canManage || busy !== null} /></label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => void save()} disabled={!props.canManage || busy !== null}>{busy === "save" ? "Guardando…" : "Guardar"}</button>
        <button className="btn secondary" type="button" onClick={() => void testConnection()} disabled={!props.canManage || !ready || busy !== null}>{busy === "test" ? "Probando…" : "Probar conexión"}</button>
        <button className="btn secondary" type="button" onClick={() => void synchronize(false)} disabled={!props.canManage || !ready || busy !== null}>{busy === "sync" ? "Sincronizando…" : "Sincronizar nuevas respuestas"}</button>
        <button className="btn secondary" type="button" onClick={() => void synchronize(true)} disabled={!props.canManage || !ready || busy !== null}>{busy === "sync-full" ? "Importando…" : "Importación completa inicial"}</button>
      </div>
      {message ? <p className="form-warning">{message}</p> : null}
    </section>

    {test ? <section className="card"><h3>Prueba de conexión</h3>{test.ok ? <p>✓ Conectada · formulario <strong>{String(testData.formName || effectiveFormId)}</strong> · {String(testData.totalResponses ?? 0)} respuestas disponibles · región {String(testData.apiRegion || "detectada")}</p> : <p className="form-warning">{test.error || "No se pudo validar la conexión."}</p>}</section> : null}

    {sync ? <section className="card"><h3>Resultado de sincronización</h3>{sync.ok ? <p>✓ Consultadas {String(syncData.fetched ?? 0)} · nuevas {String(syncData.queued ?? 0)} · ya existentes {String(syncData.duplicates ?? 0)} · errores {String(syncData.failed ?? 0)}.</p> : <p className="form-warning">{sync.error || "La sincronización necesita revisión."}</p>}</section> : null}

    <section className="card"><h3>Comportamiento operativo</h3><p>Una respuesta crea o actualiza el cliente y el lead, completa el recordatorio del formulario, añade una tarea de revisión y registra el evento en el historial. El expediente solo se crea manualmente.</p><p><Link href="/ajustes">Volver a todos los ajustes</Link></p></section>
  </div>;
}
