"use client";

import { FormEvent, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Metrics = { acceptedSale: number; paid: number; acceptedTrips: number; activeCases: number };
type Preferences = {
  travel_style: string;
  pace: string;
  accommodation: string;
  budget_band: string;
  preferred_departure_airport: string;
  interests: string[];
  preferred_destinations: string[];
  avoid_destinations: string[];
  family_notes: string;
  accessibility_notes: string;
  service_notes: string;
};
type Draft = {
  segment: string;
  relationship_status: string;
  preferred_contact_channel: string;
  risk_level: string;
  tags: string;
  next_opportunity_at: string;
  last_contact_at: string;
  preferences: Preferences;
};

const segmentLabels: Record<string, string> = { standard: "Estándar", priority: "Prioritario", vip: "VIP", corporate: "Empresa", dormant: "Inactivo" };
const relationshipLabels: Record<string, string> = { active: "Activo", nurture: "Seguimiento", dormant: "Dormido", do_not_contact: "No contactar" };
const riskLabels: Record<string, string> = { low: "Bajo", medium: "Medio", high: "Alto" };

function text(value: unknown) { return String(value ?? "").trim(); }
function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function list(value: unknown) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function commaList(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }
function dateInput(value: unknown) { return text(value).slice(0, 10); }
function dateTime(value: unknown) { const raw = text(value); if (!raw) return "—"; const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }); }
function money(value: unknown) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(numberValue(value)); }

function initialDraft(client: Row): Draft {
  const preferences = object(client.travel_preferences);
  return {
    segment: text(client.segment) || "standard",
    relationship_status: text(client.relationship_status) || "active",
    preferred_contact_channel: text(client.preferred_contact_channel) || "whatsapp",
    risk_level: text(client.risk_level) || "low",
    tags: list(client.tags).join(", "),
    next_opportunity_at: dateInput(client.next_opportunity_at),
    last_contact_at: dateInput(client.last_contact_at),
    preferences: {
      travel_style: text(preferences.travel_style),
      pace: text(preferences.pace),
      accommodation: text(preferences.accommodation),
      budget_band: text(preferences.budget_band),
      preferred_departure_airport: text(preferences.preferred_departure_airport),
      interests: list(preferences.interests),
      preferred_destinations: list(preferences.preferred_destinations),
      avoid_destinations: list(preferences.avoid_destinations),
      family_notes: text(preferences.family_notes),
      accessibility_notes: text(preferences.accessibility_notes),
      service_notes: text(preferences.service_notes),
    },
  };
}

function profileScore(client: Row, metrics: Metrics, communications: Row[]) {
  let score = 35;
  if (text(client.segment) === "vip") score += 20;
  else if (["priority", "corporate"].includes(text(client.segment))) score += 10;
  if (metrics.acceptedTrips > 1) score += 15;
  else if (metrics.acceptedTrips === 1) score += 8;
  if (metrics.acceptedSale >= 10_000) score += 15;
  else if (metrics.acceptedSale >= 3_000) score += 8;
  if (communications.some((item) => text(item.status) === "answered" || item.answered_at)) score += 7;
  if (text(client.risk_level) === "high") score -= 20;
  else if (text(client.risk_level) === "medium") score -= 10;
  if (text(client.relationship_status) === "dormant") score -= 15;
  if (text(client.relationship_status) === "do_not_contact") score = 0;
  return Math.max(0, Math.min(100, score));
}

export function ClientProfilePanel({ client, communications, metrics, onSaved }: { client: Row; communications: Row[]; metrics: Metrics; onSaved: (client: Row) => void }) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(client));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clientId = text(client.id);
  const score = useMemo(() => profileScore(client, metrics, communications), [client, communications, metrics]);
  const responseRate = communications.length ? Math.round((communications.filter((item) => text(item.status) === "answered" || item.answered_at).length / communications.length) * 100) : 0;
  const preferences = draft.preferences;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) { setDraft((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/clients/${encodeURIComponent(clientId)}/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        segment: draft.segment,
        relationship_status: draft.relationship_status,
        preferred_contact_channel: draft.preferred_contact_channel,
        risk_level: draft.risk_level,
        tags: commaList(draft.tags),
        next_opportunity_at: draft.next_opportunity_at || null,
        last_contact_at: draft.last_contact_at ? `${draft.last_contact_at}T12:00:00` : null,
        travel_preferences: draft.preferences,
      }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) { setMessage(String(result?.error || "No se pudo guardar el perfil.")); return; }
    onSaved(result.data as Row);
    setDraft(initialDraft(result.data as Row));
    setEditing(false);
    setMessage("Perfil y preferencias guardados.");
  }

  return <div className="client360-grid">
    <section className="card client360-full">
      <div className="panel-head"><div><h2>Inteligencia de cliente</h2><p>Segmentación interna para priorizar servicio, seguimiento y nuevas oportunidades.</p></div><button className={editing ? "btn secondary" : "btn"} type="button" onClick={() => { setEditing((value) => !value); setMessage(null); }}>{editing ? "Cerrar edición" : "Editar perfil"}</button></div>
      <section className="client-kpis">
        <div className="kpi-card"><span className="kpi-icon">{score}</span><span className="kpi-copy"><strong>Índice de relación</strong><b>{score}/100</b><small>Prioridad comercial orientativa</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">S</span><span className="kpi-copy"><strong>Segmento</strong><b>{segmentLabels[text(client.segment)] || "Estándar"}</b><small>{relationshipLabels[text(client.relationship_status)] || "Activo"}</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">R</span><span className="kpi-copy"><strong>Respuesta</strong><b>{responseRate}%</b><small>{communications.length} comunicaciones</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">L</span><span className="kpi-copy"><strong>Valor acumulado</strong><b>{money(metrics.acceptedSale)}</b><small>{metrics.acceptedTrips} viajes aceptados</small></span></div>
      </section>
      {message ? <p className="client-message" role="status">{message}</p> : null}
    </section>

    {editing ? <section className="card client360-full"><form className="form" onSubmit={save}>
      <div className="grid grid-3">
        <label>Segmento<select value={draft.segment} onChange={(event) => update("segment", event.target.value)}><option value="standard">Estándar</option><option value="priority">Prioritario</option><option value="vip">VIP</option><option value="corporate">Empresa</option><option value="dormant">Inactivo</option></select></label>
        <label>Relación<select value={draft.relationship_status} onChange={(event) => update("relationship_status", event.target.value)}><option value="active">Activo</option><option value="nurture">Seguimiento</option><option value="dormant">Dormido</option><option value="do_not_contact">No contactar</option></select></label>
        <label>Riesgo<select value={draft.risk_level} onChange={(event) => update("risk_level", event.target.value)}><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option></select></label>
        <label>Canal preferido<select value={draft.preferred_contact_channel} onChange={(event) => update("preferred_contact_channel", event.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Teléfono</option></select></label>
        <label>Último contacto<input className="input" type="date" value={draft.last_contact_at} onChange={(event) => update("last_contact_at", event.target.value)} /></label>
        <label>Próxima oportunidad<input className="input" type="date" value={draft.next_opportunity_at} onChange={(event) => update("next_opportunity_at", event.target.value)} /></label>
      </div>
      <label>Etiquetas<input className="input" value={draft.tags} onChange={(event) => update("tags", event.target.value)} placeholder="familia, repetidor, luna de miel" /><small>Separadas por comas.</small></label>
      <div className="grid grid-2">
        <label>Estilo de viaje<select value={preferences.travel_style} onChange={(event) => updatePreference("travel_style", event.target.value)}><option value="">Sin definir</option><option value="independent">Independiente</option><option value="guided">Guiado</option><option value="mixed">Mixto</option></select></label>
        <label>Ritmo<select value={preferences.pace} onChange={(event) => updatePreference("pace", event.target.value)}><option value="">Sin definir</option><option value="relaxed">Relajado</option><option value="balanced">Equilibrado</option><option value="intensive">Intensivo</option></select></label>
        <label>Alojamiento preferido<input className="input" value={preferences.accommodation} onChange={(event) => updatePreference("accommodation", event.target.value)} placeholder="4 estrellas, apartamento, boutique..." /></label>
        <label>Franja de presupuesto<select value={preferences.budget_band} onChange={(event) => updatePreference("budget_band", event.target.value)}><option value="">Sin definir</option><option value="economical">Económico</option><option value="medium">Medio</option><option value="premium">Premium</option><option value="luxury">Lujo</option></select></label>
        <label>Aeropuerto de salida<input className="input" value={preferences.preferred_departure_airport} onChange={(event) => updatePreference("preferred_departure_airport", event.target.value)} /></label>
        <label>Intereses<input className="input" value={preferences.interests.join(", ")} onChange={(event) => updatePreference("interests", commaList(event.target.value))} placeholder="cultura, gastronomía, naturaleza" /></label>
        <label>Destinos preferidos<input className="input" value={preferences.preferred_destinations.join(", ")} onChange={(event) => updatePreference("preferred_destinations", commaList(event.target.value))} /></label>
        <label>Destinos a evitar<input className="input" value={preferences.avoid_destinations.join(", ")} onChange={(event) => updatePreference("avoid_destinations", commaList(event.target.value))} /></label>
      </div>
      <div className="grid grid-3">
        <label>Familia y composición<textarea rows={4} value={preferences.family_notes} onChange={(event) => updatePreference("family_notes", event.target.value)} /></label>
        <label>Accesibilidad y movilidad<textarea rows={4} value={preferences.accessibility_notes} onChange={(event) => updatePreference("accessibility_notes", event.target.value)} /></label>
        <label>Claves de servicio<textarea rows={4} value={preferences.service_notes} onChange={(event) => updatePreference("service_notes", event.target.value)} /></label>
      </div>
      <div className="form-actions"><button className="btn secondary" type="button" onClick={() => { setDraft(initialDraft(client)); setEditing(false); }} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar perfil"}</button></div>
    </form></section> : <section className="card">
      <div className="panel-head"><div><h2>Preferencias consolidadas</h2><p>Información reutilizable al preparar presupuestos e itinerarios.</p></div></div>
      <dl className="client360-dl">
        <div><dt>Canal</dt><dd>{text(client.preferred_contact_channel) || "WhatsApp"}</dd></div><div><dt>Riesgo</dt><dd>{riskLabels[text(client.risk_level)] || "Bajo"}</dd></div>
        <div><dt>Estilo</dt><dd>{preferences.travel_style || "—"}</dd></div><div><dt>Ritmo</dt><dd>{preferences.pace || "—"}</dd></div>
        <div><dt>Presupuesto</dt><dd>{preferences.budget_band || "—"}</dd></div><div><dt>Salida</dt><dd>{preferences.preferred_departure_airport || "—"}</dd></div>
        <div><dt>Último contacto</dt><dd>{dateTime(client.last_contact_at)}</dd></div><div><dt>Próxima oportunidad</dt><dd>{client.next_opportunity_at ? dateTime(`${text(client.next_opportunity_at)}T12:00:00`) : "—"}</dd></div>
      </dl>
      <div className="client360-note"><strong>Intereses</strong><p>{preferences.interests.join(", ") || "Sin intereses guardados."}</p></div>
      <div className="client360-note"><strong>Etiquetas</strong><p>{list(client.tags).join(", ") || "Sin etiquetas."}</p></div>
    </section>}

    <section className="card">
      <div className="panel-head"><div><h2>Comunicaciones recientes</h2><p>Seguimientos preparados y entregas registradas.</p></div><a className="btn secondary" href={`/comunicaciones?clientId=${encodeURIComponent(clientId)}`}>Abrir comunicaciones</a></div>
      {communications.length === 0 ? <div className="empty-state"><h3>Sin comunicaciones</h3><p>Los seguimientos aparecerán aquí.</p></div> : <div className="client360-list">{communications.slice(0, 10).map((item) => <article className="client360-list-item" key={text(item.id)}><div><strong>{text(item.subject) || text(item.kind) || "Comunicación"}</strong><small>{text(item.channel)} · {dateTime(item.sent_at || item.created_at)}</small></div><span className={`status-pill ${item.failed_at ? "status-danger" : item.answered_at ? "status-done" : "status-pending"}`}>{item.failed_at ? "Fallida" : item.answered_at ? "Respondida" : text(item.provider_status || item.status) || "Pendiente"}</span></article>)}</div>}
    </section>
  </div>;
}
