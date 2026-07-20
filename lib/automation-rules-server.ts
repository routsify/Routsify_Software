import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AutomationTriggerType = "case_inactive" | "trip_starts_in";
export type AutomationPriority = "low" | "normal" | "high" | "urgent";
export type AutomationRuleInput = {
  name: string;
  enabled?: boolean;
  trigger_type: AutomationTriggerType;
  trigger_config: { days: number; statuses?: string[] };
  action_type?: "create_task";
  action_config: { title: string; priority: AutomationPriority; due_offset_days?: number; blocker?: string | null; assigned_to?: string | null };
};

type Row = Record<string, unknown>;
const CASE_STATUSES = new Set(["new_lead", "call_booked", "call_done", "budget_draft", "proposal_sent", "proposal_accepted", "documentation_approved", "contract_ready", "contract_signed", "payment_confirmed", "suppliers_pending", "ready_to_close", "closed"]);
const PRIORITIES = new Set<AutomationPriority>(["low", "normal", "high", "urgent"]);

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function dateMs(value: unknown) { const parsed = value ? new Date(String(value)).getTime() : NaN; return Number.isFinite(parsed) ? parsed : null; }
function dateOnly(value: unknown) { return text(value).slice(0, 10); }
function addDays(days: number) { return new Date(Date.now() + days * 86_400_000).toISOString(); }
function daysUntil(value: unknown) { const target = dateMs(String(value).length === 10 ? `${String(value)}T12:00:00Z` : value); return target === null ? null : Math.ceil((target - Date.now()) / 86_400_000); }
function daysSince(value: unknown) { const anchor = dateMs(value); return anchor === null ? null : Math.floor((Date.now() - anchor) / 86_400_000); }
function uuidOrNull(value: unknown) { const candidate = text(value); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null; }

export function validateAutomationRule(input: unknown): AutomationRuleInput {
  const source = record(input);
  const triggerConfig = record(source.trigger_config);
  const actionConfig = record(source.action_config);
  const name = text(source.name).slice(0, 120);
  const triggerType = text(source.trigger_type) as AutomationTriggerType;
  const days = Math.floor(numberValue(triggerConfig.days));
  const statuses = stringArray(triggerConfig.statuses).filter((status) => CASE_STATUSES.has(status) && status !== "closed");
  const title = text(actionConfig.title).slice(0, 180);
  const priority = text(actionConfig.priority || "normal") as AutomationPriority;
  const dueOffset = Math.floor(numberValue(actionConfig.due_offset_days));
  if (name.length < 3) throw new Error("automation_name_required");
  if (!(["case_inactive", "trip_starts_in"] as string[]).includes(triggerType)) throw new Error("automation_trigger_invalid");
  if (days < 0 || days > 365 || (triggerType === "case_inactive" && days < 1)) throw new Error("automation_days_invalid");
  if (title.length < 3) throw new Error("automation_task_title_required");
  if (!PRIORITIES.has(priority)) throw new Error("automation_priority_invalid");
  if (dueOffset < 0 || dueOffset > 30) throw new Error("automation_due_offset_invalid");
  return {
    name,
    enabled: source.enabled !== false,
    trigger_type: triggerType,
    trigger_config: { days, statuses },
    action_type: "create_task",
    action_config: { title, priority, due_offset_days: dueOffset, blocker: text(actionConfig.blocker).slice(0, 300) || null, assigned_to: uuidOrNull(actionConfig.assigned_to) },
  };
}

export async function listAutomationWorkspace(organizationId: string) {
  const db = getSupabaseAdminClient();
  const [rulesResult, executionsResult, usersResult] = await Promise.all([
    db.from("automation_rules").select("id,name,enabled,trigger_type,trigger_config,action_type,action_config,created_at,updated_at").eq("organization_id", organizationId).order("enabled", { ascending: false }).order("created_at", { ascending: true }),
    db.from("automation_executions").select("id,rule_id,case_id,occurrence_key,status,result,error,executed_at,automation_rules(name),cases(case_code,title,destination)").eq("organization_id", organizationId).order("executed_at", { ascending: false }).limit(100),
    db.from("profiles").select("user_id,full_name,email,role").eq("organization_id", organizationId).order("full_name", { ascending: true }),
  ]);
  const error = rulesResult.error || executionsResult.error || usersResult.error;
  if (error) throw new Error(error.message);
  return { rules: rulesResult.data || [], executions: executionsResult.data || [], users: usersResult.data || [] };
}

export async function createAutomationRule(organizationId: string, actorId: string | null, input: unknown) {
  const rule = validateAutomationRule(input);
  const { data, error } = await getSupabaseAdminClient().from("automation_rules").insert({ organization_id: organizationId, ...rule, created_by: actorId, updated_by: actorId }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAutomationRule(organizationId: string, ruleId: string, actorId: string | null, input: unknown) {
  const source = record(input);
  if (Object.keys(source).length === 1 && "enabled" in source) {
    const { data, error } = await getSupabaseAdminClient().from("automation_rules").update({ enabled: source.enabled === true, updated_by: actorId, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", ruleId).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  }
  const rule = validateAutomationRule(input);
  const { data, error } = await getSupabaseAdminClient().from("automation_rules").update({ ...rule, updated_by: actorId, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", ruleId).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAutomationRule(organizationId: string, ruleId: string) {
  const { error } = await getSupabaseAdminClient().from("automation_rules").delete().eq("organization_id", organizationId).eq("id", ruleId);
  if (error) throw new Error(error.message);
}

function triggerOccurrence(rule: Row, caseRow: Row) {
  const triggerType = text(rule.trigger_type);
  const config = record(rule.trigger_config);
  const days = Math.floor(numberValue(config.days));
  const statuses = stringArray(config.statuses);
  const caseStatus = text(caseRow.status);
  if (caseStatus === "closed" || (statuses.length && !statuses.includes(caseStatus))) return null;
  if (triggerType === "case_inactive") {
    const anchor = caseRow.last_activity_at || caseRow.last_event_at || caseRow.updated_at || caseRow.created_at;
    const inactiveDays = daysSince(anchor);
    if (inactiveDays === null || inactiveDays < days) return null;
    return { occurrenceKey: `inactive:${text(caseRow.id)}:${dateOnly(anchor)}:${days}`, context: { inactive_days: inactiveDays, anchor_date: text(anchor) } };
  }
  if (triggerType === "trip_starts_in") {
    const remaining = daysUntil(caseRow.trip_start);
    if (remaining === null || remaining < 0 || remaining > days) return null;
    return { occurrenceKey: `trip:${text(caseRow.id)}:${dateOnly(caseRow.trip_start)}:${days}`, context: { days_to_trip: remaining, trip_start: text(caseRow.trip_start) } };
  }
  return null;
}

function renderTaskTitle(template: string, caseRow: Row, context: Row) {
  const values: Row = { case_code: caseRow.case_code, destination: caseRow.destination, days_to_trip: context.days_to_trip, inactive_days: context.inactive_days };
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => text(values[key]));
}

export async function runAutomationRulesForOrganization(organizationId: string) {
  const db = getSupabaseAdminClient();
  const [rulesResult, casesResult] = await Promise.all([
    db.from("automation_rules").select("id,name,trigger_type,trigger_config,action_type,action_config").eq("organization_id", organizationId).eq("enabled", true).order("created_at", { ascending: true }),
    db.from("cases").select("id,client_id,case_code,title,status,destination,trip_start,last_activity_at,last_event_at,created_at,updated_at").eq("organization_id", organizationId).neq("status", "closed").limit(5000),
  ]);
  if (rulesResult.error || casesResult.error) throw new Error(rulesResult.error?.message || casesResult.error?.message || "automation_query_failed");
  let matched = 0;
  let executed = 0;
  let skipped = 0;
  let failed = 0;
  const details: Row[] = [];

  for (const rule of (rulesResult.data || []) as Row[]) {
    for (const caseRow of (casesResult.data || []) as Row[]) {
      const occurrence = triggerOccurrence(rule, caseRow);
      if (!occurrence) continue;
      matched += 1;
      const { data: existing, error: existingError } = await db.from("automation_executions").select("id,status").eq("rule_id", rule.id).eq("occurrence_key", occurrence.occurrenceKey).maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing && existing.status === "done") { skipped += 1; continue; }
      const action = record(rule.action_config);
      const idempotencyKey = `automation:${text(rule.id)}:${occurrence.occurrenceKey}`.slice(0, 300);
      try {
        const taskPayload = { source: "automation_rule", rule_id: rule.id, rule_name: rule.name, trigger_type: rule.trigger_type, occurrence_key: occurrence.occurrenceKey, ...occurrence.context };
        const task = {
          organization_id: organizationId,
          case_id: caseRow.id,
          client_id: caseRow.client_id || null,
          title: renderTaskTitle(text(action.title), caseRow, occurrence.context),
          status: "pending",
          priority: text(action.priority) || "normal",
          due_at: addDays(Math.max(0, Math.min(30, numberValue(action.due_offset_days)))),
          assigned_to: uuidOrNull(action.assigned_to),
          blocker: text(action.blocker) || null,
          idempotency_key: idempotencyKey,
          payload: taskPayload,
        };
        const { data: createdTask, error: taskError } = await db.from("tasks").upsert(task, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
        if (taskError) throw new Error(taskError.message);
        const result = { task_id: createdTask?.id || null, idempotency_key: idempotencyKey, context: occurrence.context };
        const { error: executionError } = await db.from("automation_executions").upsert({ organization_id: organizationId, rule_id: rule.id, case_id: caseRow.id, occurrence_key: occurrence.occurrenceKey, status: "done", result, error: null, executed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "rule_id,occurrence_key" });
        if (executionError) throw new Error(executionError.message);
        await db.from("timeline_events").insert({ organization_id: organizationId, case_id: caseRow.id, client_id: caseRow.client_id || null, event_type: "automation.task_created", title: `Automatización ejecutada: ${text(rule.name)}`, payload: result });
        executed += 1;
        details.push({ rule_id: rule.id, case_id: caseRow.id, status: "done", task_id: result.task_id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "automation_execution_failed";
        await db.from("automation_executions").upsert({ organization_id: organizationId, rule_id: rule.id, case_id: caseRow.id, occurrence_key: occurrence.occurrenceKey, status: "failed", result: {}, error: message, executed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "rule_id,occurrence_key" });
        failed += 1;
        details.push({ rule_id: rule.id, case_id: caseRow.id, status: "failed", error: message });
      }
    }
  }
  return { organizationId, rules: rulesResult.data?.length || 0, cases: casesResult.data?.length || 0, matched, executed, skipped, failed, details: details.slice(0, 100) };
}

export async function runAutomationRulesForAllOrganizations() {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("organizations").select("id");
  if (error) throw new Error(error.message);
  const results = [];
  for (const organization of data || []) {
    try { results.push({ ok: true, ...(await runAutomationRulesForOrganization(String(organization.id))) }); }
    catch (caught) { results.push({ ok: false, organizationId: String(organization.id), error: caught instanceof Error ? caught.message : "automation_run_failed" }); }
  }
  return { organizations: results.length, failedOrganizations: results.filter((item) => !item.ok).length, executed: results.reduce((sum, item) => sum + ("executed" in item ? Number(item.executed || 0) : 0), 0), results };
}
