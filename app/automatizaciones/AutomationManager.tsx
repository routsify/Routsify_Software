"use client";

import { FormEvent, useMemo, useState } from "react";

 type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: "case_inactive" | "trip_starts_in";
  trigger_config: { days?: number; statuses?: string[] };
  action_config: { title?: string; priority?: string; due_offset_days?: number; blocker?: string | null; assigned_to?: string | null };
  created_at?: string;
  updated_at?: string;
};
type Execution = { id: string; rule_id: string; case_id: string; status: string; error?: string | null; executed_at?: string; automation_rules?: unknown; cases?: unknown; result?: Record<string, unknown> };
type UserOption = { user_id: string; full_name?: string | null; email?: string | null; role?: string | null };
type Draft = { name: string; trigger_type: "case_inactive" | "trip_starts_in"; days: number; statuses: string[]; title: string; priority: "low" | "normal" | "high" | "urgent"; due_offset_days: number; blocker: string; assigned_to: string; enabled: boolean };

const statusOptions = [
  ["new_lead", "Nuevo lead"], ["call_booked", "Llamada reservada"], ["call_done", "Llamada realizada"],
  ["budget_draft", "Presupuesto en preparación"], ["proposal_sent", "Presupuesto enviado"], ["proposal_accepted", "Presupuesto aceptado"],
  ["documentation_approved", "Documentación aprobada"], ["contract_ready", "Contrato preparado"], ["contract_signed", "Contrato firmado"],
  ["payment_confirmed", "Pago confirmado"], ["suppliers_pending", "Proveedores pendientes"], ["ready_to_close", "Listo para cierre"],
] as const;

const emptyDraft: Draft = { name: "", trigger_type: "case_inactive", days: 3, statuses: [], title: "Revisar expediente {{case_code}}", priority: "high", due_offset_days: 0, blocker: "", assigned_to: "", enabled: true };
const presets: Record<string, Draft> = {
  inactive3: { name: "Expedientes comerciales sin actividad", trigger_type: "case_inactive", days: 3, statuses: ["new_lead", "call_booked", "call_done", "budget_draft", "proposal_sent"], title: "Revisar expediente sin actividad: {{case_code}}", priority: "high", due_offset_days: 0, blocker: "", assigned_to: "", enabled: true },
  trip30: { name: "Revisión 30 días antes del viaje", trigger_type: "trip_starts_in", days: 30, statuses: ["proposal_accepted", "documentation_approved", "contract_ready", "contract_signed", "payment_confirmed", "suppliers_pending"], title: "Revisión de contrato, cobros y reservas: {{case_code}}", priority: "high", due_offset_days: 0, blocker: "", assigned_to: "", enabled: true },
  trip14: { name: "Control documental y proveedores a 14 días", trigger_type: "trip_starts_in", days: 14, statuses: ["documentation_approved", "contract_ready", "contract_signed", "payment_confirmed", "suppliers_pending"], title: "Confirmar documentación y proveedores: {{case_code}}", priority: "urgent", due_offset_days: 0, blocker: "", assigned_to: "", enabled: true },
  trip3: { name: "Comprobación final a 3 días", trigger_type: "trip_starts_in", days: 3, statuses: ["contract_signed", "payment_confirmed", "suppliers_pending", "ready_to_close"], title: "Comprobación final del viaje {{case_code}} · {{destination}}", priority: "urgent", due_offset_days: 0, blocker: "", assigned_to: "", enabled: true },
};

function object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function firstObject(value: unknown) { return Array.isArray(value) ? object(value[0]) : object(value); }
function normalizeRule(value: unknown): Rule {
  const row = object(value); const trigger = object(row.trigger_config); const action = object(row.action_config);
  return { id: String(row.id || crypto.randomUUID()), name: String(row.name || "Automatización"), enabled: row.enabled !== false, trigger_type: row.trigger_type === "trip_starts_in" ? "trip_starts_in" : "case_inactive", trigger_config: { days: Number(trigger.days || 0), statuses: Array.isArray(trigger.statuses) ? trigger.statuses.map(String) : [] }, action_config: { title: String(action.title || ""), priority: String(action.priority || "normal"), due_offset_days: Number(action.due_offset_days || 0), blocker: action.blocker ? String(action.blocker) : null, assigned_to: action.assigned_to ? String(action.assigned_to) : null }, created_at: row.created_at ? String(row.created_at) : undefined, updated_at: row.updated_at ? String(row.updated_at) : undefined };
}
function normalizeExecution(value: unknown): Execution { const row = object(value); return { id: String(row.id || crypto.randomUUID()), rule_id: String(row.rule_id || ""), case_id: String(row.case_id || ""), status: String(row.status || ""), error: row.error ? String(row.error) : null, executed_at: row.executed_at ? String(row.executed_at) : undefined, automation_rules: row.automation_rules, cases: row.cases, result: object(row.result) }; }
function dateTime(value?: string) { return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—"; }
function triggerText(rule: Rule) { const days = Number(rule.trigger_config.days || 0); return rule.trigger_type === "case_inactive" ? `Expediente sin actividad durante ${days} día${days === 1 ? "" : "s"}` : `Viaje que comienza en ${days} día${days === 1 ? "" : "s"} o menos`; }
function errorText(error: string) {
  const map: Record<string, string> = { automation_name_required: "Escribe un nombre para la regla.", automation_days_invalid: "El número de días no es válido.", automation_task_title_required: "Escribe el título de la tarea.", automation_priority_invalid: "La prioridad no es válida." };
  return map[error] || error || "No se pudo guardar la automatización.";
}

export function AutomationManager({ initialRules, initialExecutions, users }: { initialRules: unknown[]; initialExecutions: unknown[]; users: unknown[] }) {
  const [rules, setRules] = useState(() => initialRules.map(normalizeRule));
  const [executions, setExecutions] = useState(() => initialExecutions.map(normalizeExecution));
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userOptions = users.map((value) => { const row = object(value); return { user_id: String(row.user_id || ""), full_name: row.full_name ? String(row.full_name) : null, email: row.email ? String(row.email) : null, role: row.role ? String(row.role) : null } satisfies UserOption; }).filter((user) => user.user_id);
  const stats = useMemo(() => ({ active: rules.filter((rule) => rule.enabled).length, total: rules.length, done: executions.filter((item) => item.status === "done").length, failed: executions.filter((item) => item.status === "failed").length }), [rules, executions]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function applyPreset(key: string) { const preset = presets[key]; if (!preset) return; setDraft({ ...preset }); setShowForm(true); setMessage(null); }
  function toggleStatus(status: string) { setDraft((current) => ({ ...current, statuses: current.statuses.includes(status) ? current.statuses.filter((item) => item !== status) : [...current.statuses, status] })); }

  async function refresh() {
    const response = await fetch("/api/routsify/automations", { cache: "no-store" }); const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) return;
    setRules((result.data.rules || []).map(normalizeRule)); setExecutions((result.data.executions || []).map(normalizeExecution));
  }
  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null);
    const response = await fetch("/api/routsify/automations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: draft.name, enabled: draft.enabled, trigger_type: draft.trigger_type, trigger_config: { days: draft.days, statuses: draft.statuses }, action_type: "create_task", action_config: { title: draft.title, priority: draft.priority, due_offset_days: draft.due_offset_days, blocker: draft.blocker || null, assigned_to: draft.assigned_to || null } }) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(errorText(String(result?.error || "")));
    setDraft(emptyDraft); setShowForm(false); setMessage("Automatización creada. Se ejecutará diariamente y también puedes probarla ahora."); await refresh();
  }
  async function toggleRule(rule: Rule) {
    setMessage(null); const response = await fetch(`/api/routsify/automations/${encodeURIComponent(rule.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) });
    const result = await response.json().catch(() => null); if (!response.ok || !result?.ok) return setMessage(errorText(String(result?.error || ""))); await refresh();
  }
  async function deleteRule(rule: Rule) {
    if (!window.confirm(`Eliminar la automatización “${rule.name}”? Se conservará el historial de las tareas ya creadas.`)) return;
    const response = await fetch(`/api/routsify/automations/${encodeURIComponent(rule.id)}`, { method: "DELETE" }); const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) return setMessage(errorText(String(result?.error || ""))); setMessage("Automatización eliminada."); await refresh();
  }
  async function runNow() {
    setRunning(true); setMessage(null); const response = await fetch("/api/routsify/automations/run", { method: "POST" }); const result = await response.json().catch(() => null); setRunning(false);
    if (!response.ok && response.status !== 207) return setMessage(errorText(String(result?.error || "")));
    const data = result?.data || {}; setMessage(`Ejecución terminada: ${Number(data.executed || 0)} tareas creadas, ${Number(data.skipped || 0)} coincidencias ya procesadas y ${Number(data.failed || 0)} errores.`); await refresh();
  }
  function useAsBase(rule: Rule) { setDraft({ name: `${rule.name} (copia)`, trigger_type: rule.trigger_type, days: Number(rule.trigger_config.days || 0), statuses: [...(rule.trigger_config.statuses || [])], title: String(rule.action_config.title || ""), priority: (rule.action_config.priority as Draft["priority"]) || "normal", due_offset_days: Number(rule.action_config.due_offset_days || 0), blocker: String(rule.action_config.blocker || ""), assigned_to: String(rule.action_config.assigned_to || ""), enabled: true }); setShowForm(true); }

  return <div className="clients-page">
    <section className="client-kpis"><Kpi icon="A" label="Reglas activas" value={stats.active} note={`${stats.total} configuradas`} /><Kpi icon="✓" label="Ejecuciones correctas" value={stats.done} note="Últimas 100 ejecuciones" /><Kpi icon="!" label="Fallidas" value={stats.failed} note={stats.failed ? "Requieren revisión" : "Sin errores"} /><Kpi icon="D" label="Frecuencia" value="Diaria" note="Cron 05:15 UTC" /></section>
    <section className="card"><div className="panel-head"><div><h2>Automatizaciones recomendadas</h2><p>Activa las reglas que más tiempo ahorran en la operativa habitual.</p></div><button className="btn" type="button" onClick={() => void runNow()} disabled={running || !rules.some((rule) => rule.enabled)}>{running ? "Ejecutando..." : "Ejecutar ahora"}</button></div><div className="grid grid-2"><Preset title="Seguimiento comercial" text="Crea una tarea si un expediente comercial lleva 3 días sin actividad." onClick={() => applyPreset("inactive3")} /><Preset title="Control a 30 días" text="Revisa contrato, cobros y reservas un mes antes del viaje." onClick={() => applyPreset("trip30")} /><Preset title="Control a 14 días" text="Confirma documentación y proveedores dos semanas antes." onClick={() => applyPreset("trip14")} /><Preset title="Comprobación final" text="Genera una tarea urgente tres días antes de la salida." onClick={() => applyPreset("trip3")} /></div></section>
    <div className="form-actions"><button className={showForm ? "btn secondary" : "btn"} type="button" onClick={() => { setShowForm((current) => !current); setMessage(null); }}>{showForm ? "Cerrar constructor" : "Nueva automatización"}</button>{message ? <span className="client-message" role="status">{message}</span> : null}</div>
    {showForm ? <RuleForm draft={draft} users={userOptions} saving={saving} update={update} toggleStatus={toggleStatus} onSubmit={createRule} onCancel={() => setShowForm(false)} /> : null}
    <section className="card dashboard-table-card"><div className="panel-head"><div><h2>Reglas configuradas</h2><p>Las reglas son idempotentes: una misma condición no crea tareas duplicadas.</p></div></div>{rules.length === 0 ? <div className="empty-state"><h2>No hay automatizaciones</h2><p>Empieza con una de las recomendaciones.</p></div> : <div className="table-scroll"><table><thead><tr><th>Regla</th><th>Condición</th><th>Tarea</th><th>Responsable</th><th>Estado</th><th></th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id}><td><strong>{rule.name}</strong><br /><small>{(rule.trigger_config.statuses || []).length ? `${rule.trigger_config.statuses?.length} estados incluidos` : "Todos los estados activos"}</small></td><td>{triggerText(rule)}</td><td>{rule.action_config.title}<br /><small>{rule.action_config.priority || "normal"} · vence +{rule.action_config.due_offset_days || 0} días</small></td><td>{userOptions.find((user) => user.user_id === rule.action_config.assigned_to)?.full_name || "Sin asignar"}</td><td><button className={rule.enabled ? "status-pill status-done" : "status-pill"} type="button" onClick={() => void toggleRule(rule)}>{rule.enabled ? "Activa" : "Pausada"}</button></td><td><div className="form-actions"><button className="link-button" type="button" onClick={() => useAsBase(rule)}>Duplicar</button><button className="link-button danger-text" type="button" onClick={() => void deleteRule(rule)}>Eliminar</button></div></td></tr>)}</tbody></table></div>}</section>
    <section className="card dashboard-table-card"><div className="panel-head"><div><h2>Historial de ejecuciones</h2><p>Auditoría de las últimas 100 condiciones procesadas.</p></div></div>{executions.length === 0 ? <div className="empty-state"><h2>Sin ejecuciones todavía</h2><p>Ejecuta las reglas o espera al próximo cron.</p></div> : <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Regla</th><th>Expediente</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>{executions.map((item) => { const rule = firstObject(item.automation_rules); const caseRow = firstObject(item.cases); return <tr key={item.id}><td>{dateTime(item.executed_at)}</td><td>{String(rule.name || rules.find((candidate) => candidate.id === item.rule_id)?.name || "Regla eliminada")}</td><td>{String(caseRow.case_code || caseRow.title || item.case_id)}</td><td><span className={item.status === "done" ? "status-pill status-done" : "status-pill status-danger"}>{item.status === "done" ? "Correcta" : "Fallida"}</span></td><td>{item.error || (item.result?.task_id ? `Tarea ${String(item.result.task_id).slice(0, 8)}` : "Procesada")}</td></tr>; })}</tbody></table></div>}</section>
  </div>;
}

function Kpi({ icon, label, value, note }: { icon: string; label: string; value: string | number; note: string }) { return <div className="kpi-card"><span className="kpi-icon">{icon}</span><span className="kpi-copy"><strong>{label}</strong><b>{value}</b><small>{note}</small></span></div>; }
function Preset({ title, text, onClick }: { title: string; text: string; onClick: () => void }) { return <button className="quick-action" type="button" onClick={onClick}><span><strong>{title}</strong><br /><small>{text}</small></span><span>Configurar →</span></button>; }
function RuleForm({ draft, users, saving, update, toggleStatus, onSubmit, onCancel }: { draft: Draft; users: UserOption[]; saving: boolean; update: <K extends keyof Draft>(key: K, value: Draft[K]) => void; toggleStatus: (status: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Constructor de reglas</div><h2>Cuando ocurra una condición, crear una tarea</h2><p>Las tareas quedan vinculadas al expediente y registradas en su cronología.</p></div><button className="btn secondary" type="button" onClick={onCancel}>Cerrar</button></div><form className="form" onSubmit={onSubmit}><div className="grid grid-2"><label>Nombre de la regla<input className="input" required value={draft.name} onChange={(event) => update("name", event.target.value)} /></label><label>Condición<select value={draft.trigger_type} onChange={(event) => update("trigger_type", event.target.value as Draft["trigger_type"])}><option value="case_inactive">Expediente sin actividad</option><option value="trip_starts_in">Viaje próximo</option></select></label></div><div className="grid grid-2"><label>{draft.trigger_type === "case_inactive" ? "Días sin actividad" : "Días antes del viaje"}<input className="input" type="number" min={draft.trigger_type === "case_inactive" ? 1 : 0} max={365} value={draft.days} onChange={(event) => update("days", Number(event.target.value))} /></label><label>Prioridad<select value={draft.priority} onChange={(event) => update("priority", event.target.value as Draft["priority"])}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label></div><label>Título de la tarea<input className="input" required value={draft.title} onChange={(event) => update("title", event.target.value)} /><small>Variables: {"{{case_code}}"}, {"{{destination}}"}, {"{{days_to_trip}}"}, {"{{inactive_days}}"}</small></label><div className="grid grid-2"><label>Vencimiento después de crearla<input className="input" type="number" min={0} max={30} value={draft.due_offset_days} onChange={(event) => update("due_offset_days", Number(event.target.value))} /></label><label>Responsable<select value={draft.assigned_to} onChange={(event) => update("assigned_to", event.target.value)}><option value="">Sin asignar</option>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name || user.email || user.user_id}</option>)}</select></label></div><label>Bloqueo o instrucción especial<input className="input" value={draft.blocker} onChange={(event) => update("blocker", event.target.value)} placeholder="Opcional" /></label><fieldset><legend>Estados incluidos</legend><p>Sin seleccionar ninguno, se aplicará a todos los expedientes activos.</p><div className="grid grid-3">{statusOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.statuses.includes(value)} onChange={() => toggleStatus(value)} /> {label}</label>)}</div></fieldset><label><input type="checkbox" checked={draft.enabled} onChange={(event) => update("enabled", event.target.checked)} /> Activar al guardar</label><div className="form-actions"><button className="btn secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar automatización"}</button></div></form></section>;
}
