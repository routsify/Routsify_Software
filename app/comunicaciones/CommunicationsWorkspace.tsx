"use client";

import { useMemo, useState } from "react";
import type { CommunicationCadenceSettings } from "@/lib/communication-settings-server";
import type { CommunicationFollowup, CommunicationStatus, CommunicationTemplate } from "@/lib/communications-server";

type WorkspaceData = {
  templates: CommunicationTemplate[];
  followups: CommunicationFollowup[];
  summary: { pending: number; due: number; sent: number; answered: number };
};

type Tab = "pending" | "sent" | "answered" | "all" | "templates" | "settings";

const kindLabels: Record<string, string> = {
  fillout_reminder: "Formulario pendiente",
  proposal_followup: "Seguimiento de presupuesto",
  contract_reminder: "Firma de contrato",
  payment_reminder: "Pago pendiente",
  supplier_confirmation: "Confirmación de proveedor",
  supplier_invoice_request: "Factura de proveedor",
};

const statusLabels: Record<CommunicationStatus, string> = {
  planned: "Planificada",
  prepared: "Preparada",
  sent: "Enviada",
  answered: "Respondida",
  cancelled: "Cancelada",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: CommunicationStatus) {
  if (status === "answered") return "status-success";
  if (status === "sent") return "status-progress";
  if (status === "cancelled") return "status-danger";
  if (status === "prepared") return "status-warning";
  return "status-pending";
}

function messageHref(item: CommunicationFollowup) {
  if (item.channel === "email") {
    if (!item.recipient_email) return null;
    const params = new URLSearchParams();
    if (item.subject) params.set("subject", item.subject);
    params.set("body", item.body);
    return `mailto:${item.recipient_email}?${params.toString()}`;
  }
  const phone = String(item.recipient_phone || "").replace(/\D/g, "");
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(item.body)}`;
}

function contextHref(item: CommunicationFollowup) {
  if (item.purchase_id) return `/compras?caseId=${encodeURIComponent(String(item.case_id || ""))}`;
  if (item.proposal_id) return `/propuestas?caseId=${encodeURIComponent(String(item.case_id || ""))}`;
  if (item.case_id) return `/expedientes?caseId=${encodeURIComponent(item.case_id)}`;
  if (item.client_id) return `/clientes/${encodeURIComponent(item.client_id)}`;
  return "/hoy";
}

function TemplateEditor({ template, canEdit, onSaved }: { template: CommunicationTemplate; canEdit: boolean; onSaved: (value: CommunicationTemplate) => void }) {
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject_template || "");
  const [body, setBody] = useState(template.body_template);
  const [active, setActive] = useState(template.active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/routsify/communications/templates/${encodeURIComponent(template.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, subjectTemplate: subject || null, bodyTemplate: body, active }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo guardar la plantilla."));
      return;
    }
    onSaved(result.data as CommunicationTemplate);
    setMessage("Plantilla guardada.");
  }

  return <article className="card communication-template-card">
    <div className="communication-template-head">
      <div><strong>{template.key}</strong><small>{template.audience === "client" ? "Cliente" : "Proveedor"} · {template.channel === "email" ? "Email" : "WhatsApp"}</small></div>
      <label className="communication-switch"><input type="checkbox" checked={active} disabled={!canEdit} onChange={(event) => setActive(event.target.checked)} /> Activa</label>
    </div>
    <label>Nombre<input value={name} disabled={!canEdit} onChange={(event) => setName(event.target.value)} /></label>
    {template.channel === "email" ? <label>Asunto<input value={subject} disabled={!canEdit} onChange={(event) => setSubject(event.target.value)} /></label> : null}
    <label>Mensaje<textarea rows={7} value={body} disabled={!canEdit} onChange={(event) => setBody(event.target.value)} /></label>
    <small>Variables admitidas: {"{{client_name}}"}, {"{{case_code}}"}, {"{{destination}}"}, {"{{pending_amount}}"}, {"{{supplier_name}}"}, {"{{service}}"}, {"{{trip_start}}"}, {"{{fillout_url}}"}.</small>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {canEdit ? <button className="btn secondary" type="button" disabled={saving || !body.trim()} onClick={() => void save()}>{saving ? "Guardando..." : "Guardar plantilla"}</button> : null}
  </article>;
}

function SettingsEditor({ initial, canEdit }: { initial: CommunicationCadenceSettings; canEdit: boolean }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function numberField(field: keyof CommunicationCadenceSettings, label: string, min: number, max: number) {
    return <label>{label}<input type="number" min={min} max={max} disabled={!canEdit} value={Number(values[field])} onChange={(event) => setValues((current) => ({ ...current, [field]: Number(event.target.value) }))} /></label>;
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/routsify/communications/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo guardar la cadencia."));
      return;
    }
    setValues(result.data as CommunicationCadenceSettings);
    setMessage("Cadencias guardadas.");
  }

  return <section className="card communication-settings-card">
    <div className="panel-head"><div><h2>Cadencias de seguimiento</h2><p>El sistema prepara tareas y mensajes. No envía automáticamente sin un proveedor externo configurado.</p></div></div>
    <div className="communication-settings-grid">
      <label className="communication-switch"><input type="checkbox" checked={values.enabled} disabled={!canEdit} onChange={(event) => setValues((current) => ({ ...current, enabled: event.target.checked }))} /> Activar generación de seguimientos</label>
      <label>Canal preferido<select value={values.preferredChannel} disabled={!canEdit} onChange={(event) => setValues((current) => ({ ...current, preferredChannel: event.target.value as CommunicationCadenceSettings["preferredChannel"] }))}>
        <option value="whatsapp_then_email">WhatsApp y, si falta teléfono, email</option>
        <option value="email_then_whatsapp">Email y, si falta email, WhatsApp</option>
        <option value="email_only">Solo email</option>
        <option value="whatsapp_only">Solo WhatsApp</option>
      </select></label>
      {numberField("proposalFollowupDays", "Seguimiento de presupuesto (días)", 1, 60)}
      {numberField("contractFollowupDays", "Recordatorio de firma (días)", 1, 60)}
      {numberField("paymentFollowupDays", "Recordatorio de pago (días)", 1, 90)}
      {numberField("supplierInvoiceFollowupDays", "Reclamar factura proveedor (días)", 1, 90)}
      {numberField("supplierConfirmationDays", "Confirmar proveedor (días)", 1, 120)}
      {numberField("repeatDays", "Repetir si no responde (días)", 1, 30)}
      {numberField("maxSteps", "Máximo de intentos", 1, 8)}
    </div>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {canEdit ? <button className="btn" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Guardando..." : "Guardar cadencias"}</button> : <p className="muted">Solo Dirección o Administración puede cambiar las cadencias.</p>}
  </section>;
}

export function CommunicationsWorkspace({
  initialWorkspace,
  initialSettings,
  canManage,
  canManageTemplates,
  generatedAt,
  initialSyncError,
}: {
  initialWorkspace: WorkspaceData;
  initialSettings: CommunicationCadenceSettings;
  canManage: boolean;
  canManageTemplates: boolean;
  generatedAt: string;
  initialSyncError: string | null;
}) {
  const [followups, setFollowups] = useState(initialWorkspace.followups);
  const [templates, setTemplates] = useState(initialWorkspace.templates);
  const [tab, setTab] = useState<Tab>("pending");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(initialSyncError ? `No se pudo actualizar la bandeja: ${initialSyncError}` : null);
  const nowMs = useMemo(() => new Date(generatedAt).getTime(), [generatedAt]);

  const summary = useMemo(() => ({
    pending: followups.filter((item) => item.status === "planned" || item.status === "prepared").length,
    due: followups.filter((item) => (item.status === "planned" || item.status === "prepared") && new Date(item.due_at).getTime() <= nowMs).length,
    sent: followups.filter((item) => item.status === "sent").length,
    answered: followups.filter((item) => item.status === "answered").length,
  }), [followups, nowMs]);

  const visible = useMemo(() => {
    if (tab === "pending") return followups.filter((item) => item.status === "planned" || item.status === "prepared");
    if (tab === "sent") return followups.filter((item) => item.status === "sent");
    if (tab === "answered") return followups.filter((item) => item.status === "answered");
    if (tab === "all") return followups;
    return [];
  }, [followups, tab]);

  async function changeStatus(id: string, status: Exclude<CommunicationStatus, "planned">) {
    setSavingId(id);
    setMessage(null);
    const response = await fetch(`/api/routsify/communications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo actualizar la comunicación."));
      return;
    }
    setFollowups((current) => current.map((item) => item.id === id ? result.data as CommunicationFollowup : item));
    setMessage(status === "sent" ? "Envío registrado y siguiente seguimiento programado." : status === "answered" ? "Respuesta registrada; la cadencia queda cerrada." : status === "cancelled" ? "Seguimiento cancelado." : "Mensaje marcado como preparado.");
  }

  async function sync() {
    setSyncing(true);
    setMessage(null);
    const response = await fetch("/api/routsify/communications/sync", { method: "POST" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setSyncing(false);
      setMessage(String(result?.error || "No se pudo actualizar la bandeja."));
      return;
    }
    window.location.reload();
  }

  async function copyBody(item: CommunicationFollowup) {
    try {
      await navigator.clipboard.writeText(item.body);
      setMessage("Mensaje copiado.");
    } catch {
      setMessage("No se pudo copiar automáticamente; selecciona el texto del mensaje.");
    }
  }

  return <div className="communications-workspace">
    <section className="home-kpis communication-kpis">
      <button className="kpi-card" type="button" onClick={() => setTab("pending")}><span className="kpi-copy"><strong>Pendientes</strong><b>{summary.pending}</b><small>Planificadas o preparadas</small></span></button>
      <button className="kpi-card" type="button" onClick={() => setTab("pending")}><span className="kpi-copy"><strong>Vencidas</strong><b>{summary.due}</b><small>Requieren atención hoy</small></span></button>
      <button className="kpi-card" type="button" onClick={() => setTab("sent")}><span className="kpi-copy"><strong>Enviadas</strong><b>{summary.sent}</b><small>Esperando respuesta</small></span></button>
      <button className="kpi-card" type="button" onClick={() => setTab("answered")}><span className="kpi-copy"><strong>Respondidas</strong><b>{summary.answered}</b><small>Seguimientos cerrados</small></span></button>
    </section>

    <section className="communication-toolbar card">
      <div className="communication-tabs">
        {(["pending", "sent", "answered", "all"] as Tab[]).map((value) => <button className={tab === value ? "active" : ""} type="button" key={value} onClick={() => setTab(value)}>{value === "pending" ? "Pendientes" : value === "sent" ? "Enviadas" : value === "answered" ? "Respondidas" : "Historial"}</button>)}
        <button className={tab === "templates" ? "active" : ""} type="button" onClick={() => setTab("templates")}>Plantillas</button>
        <button className={tab === "settings" ? "active" : ""} type="button" onClick={() => setTab("settings")}>Cadencias</button>
      </div>
      {canManage ? <button className="btn secondary" type="button" disabled={syncing} onClick={() => void sync()}>{syncing ? "Actualizando..." : "Actualizar seguimientos"}</button> : null}
    </section>

    {message ? <p className="client-message" role="status">{message}</p> : null}

    {tab === "templates" ? <section className="communication-template-grid">
      {templates.map((template) => <TemplateEditor key={template.id} template={template} canEdit={canManageTemplates} onSaved={(saved) => setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item))} />)}
    </section> : null}

    {tab === "settings" ? <SettingsEditor initial={initialSettings} canEdit={canManageTemplates} /> : null}

    {!["templates", "settings"].includes(tab) ? <section className="card communication-list-card">
      <div className="panel-head"><div><h2>{tab === "pending" ? "Mensajes que requieren acción" : tab === "sent" ? "Enviados sin respuesta registrada" : tab === "answered" ? "Seguimientos respondidos" : "Historial de comunicaciones"}</h2><p>Actualizado {formatDate(generatedAt)}. Abrir un mensaje no lo marca como enviado; registra el envío después de comprobarlo.</p></div></div>
      {visible.length === 0 ? <div className="empty-state"><h2>No hay comunicaciones en esta sección</h2><p>El motor generará seguimientos cuando se cumplan las cadencias configuradas.</p></div> : <div className="communication-list">
        {visible.map((item) => {
          const href = messageHref(item);
          const due = new Date(item.due_at).getTime() <= nowMs && (item.status === "planned" || item.status === "prepared");
          return <article className={`communication-item ${due ? "communication-item-due" : ""}`} key={item.id}>
            <div className="communication-item-head">
              <div><span className="eyebrow">{kindLabels[item.kind] || item.kind}</span><h3>{item.recipient_name || "Contacto sin nombre"}</h3><p>{item.channel === "email" ? item.recipient_email : item.recipient_phone} · intento {item.sequence_step}</p></div>
              <span className={`status-pill ${statusClass(item.status)}`}>{statusLabels[item.status]}</span>
            </div>
            <div className="communication-dates"><span><strong>Preparar:</strong> {formatDate(item.due_at)}</span>{item.sent_at ? <span><strong>Enviado:</strong> {formatDate(item.sent_at)}</span> : null}{item.next_followup_at ? <span><strong>Siguiente revisión:</strong> {formatDate(item.next_followup_at)}</span> : null}</div>
            {item.subject ? <div className="communication-subject"><strong>Asunto:</strong> {item.subject}</div> : null}
            <pre className="communication-body">{item.body}</pre>
            <div className="communication-actions">
              <a className="btn secondary" href={contextHref(item)}>Abrir contexto</a>
              <button className="link-button" type="button" onClick={() => void copyBody(item)}>Copiar mensaje</button>
              {href ? <a className="btn" href={href} target={item.channel === "whatsapp" ? "_blank" : undefined} rel={item.channel === "whatsapp" ? "noreferrer" : undefined}>Abrir {item.channel === "email" ? "email" : "WhatsApp"}</a> : null}
              {canManage && item.status === "planned" ? <button className="link-button" type="button" disabled={savingId === item.id} onClick={() => void changeStatus(item.id, "prepared")}>Marcar preparada</button> : null}
              {canManage && (item.status === "planned" || item.status === "prepared") ? <button className="link-button" type="button" disabled={savingId === item.id} onClick={() => void changeStatus(item.id, "sent")}>{savingId === item.id ? "Guardando..." : "Registrar envío"}</button> : null}
              {canManage && item.status === "sent" ? <button className="link-button" type="button" disabled={savingId === item.id} onClick={() => void changeStatus(item.id, "answered")}>Registrar respuesta</button> : null}
              {canManage && !["answered", "cancelled"].includes(item.status) ? <button className="link-button danger" type="button" disabled={savingId === item.id} onClick={() => void changeStatus(item.id, "cancelled")}>Cancelar</button> : null}
            </div>
          </article>;
        })}
      </div>}
    </section> : null}
  </div>;
}
