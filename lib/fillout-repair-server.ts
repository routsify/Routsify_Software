import { createHash } from "node:crypto";
import { normalizeFilloutSubmission } from "@/lib/fillout-submission-server";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const REPAIR_TOKEN_HASH = "b4038a4c58200676d639b04681a2e7684bc45241f640d7e57e17822ad4ce0548";
const FILLOUT_ORIGINS = ["https://api.fillout.com/v1/api", "https://eu-api.fillout.com/v1/api"] as const;
const PAGE_SIZE = 150;

type JsonRow = Record<string, unknown>;
type Phase = "stage" | "reset" | "enqueue" | "process" | "enrich" | "verify";

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizePhone(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function validEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return email.includes("@") && email.includes(".") ? email : "";
}

function settingValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) return (value as JsonRow).value;
  return value;
}

function chunks<T>(rows: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

export function validFilloutRepairToken(token: string) {
  if (!token) return false;
  const actual = createHash("sha256").update(token).digest("hex");
  return actual.length === REPAIR_TOKEN_HASH.length && actual === REPAIR_TOKEN_HASH;
}

async function loadSettings(organizationId: string) {
  const db = getSupabaseAdminClient();
  const keys = ["integrations.fillout.form_id", "integrations.fillout.public_url", "integrations.fillout.source_label"];
  const { data, error } = await db.from("routsify_settings").select("key,value").eq("organization_id", organizationId).in("key", keys);
  if (error) throw new Error(error.message);
  const values = new Map((data || []).map((row) => [String(row.key), settingValue(row.value)]));
  const publicUrl = text(values.get("integrations.fillout.public_url"));
  let formId = text(values.get("integrations.fillout.form_id"));
  if (!formId && publicUrl) {
    const parts = new URL(publicUrl).pathname.split("/").filter(Boolean);
    formId = parts.at(-1) || "";
  }
  if (!formId) throw new Error("fillout_form_id_missing");
  return { formId, publicUrl, sourceLabel: text(values.get("integrations.fillout.source_label")) || "Fillout" };
}

async function filloutRequest<T>(apiKey: string, path: string): Promise<{ data: T; origin: string }> {
  let lastError = "fillout_request_failed";
  for (const origin of FILLOUT_ORIGINS) {
    const response = await fetch(`${origin}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.text();
    let parsed: unknown = null;
    try { parsed = body ? JSON.parse(body) : null; } catch { parsed = body; }
    if (response.ok) return { data: parsed as T, origin };
    lastError = parsed && typeof parsed === "object" && "message" in parsed ? text((parsed as JsonRow).message) : `fillout_http_${response.status}`;
    if (![401, 403, 404].includes(response.status)) break;
  }
  throw new Error(lastError);
}

async function backupRows(input: { runId: string; organizationId: string; entityType: string; rows: JsonRow[] }) {
  if (!input.rows.length) return;
  const db = getSupabaseAdminClient();
  const backup = input.rows.map((row) => ({
    run_id: input.runId,
    organization_id: input.organizationId,
    provider: "fillout",
    entity_type: input.entityType,
    entity_id: text(row.id),
    payload: row,
  }));
  for (const batch of chunks(backup)) {
    const { error } = await db.from("integration_repair_backups").upsert(batch, { onConflict: "run_id,entity_type,entity_id" });
    if (error) throw new Error(error.message);
  }
}

async function stage(organizationId: string, runId: string) {
  const db = getSupabaseAdminClient();
  const [{ formId, sourceLabel }, apiKey] = await Promise.all([
    loadSettings(organizationId),
    getOrganizationSecret(organizationId, "fillout_webhook_secret"),
  ]);
  if (!apiKey) throw new Error("fillout_api_key_not_configured");

  await db.from("integration_repair_staging").delete().eq("run_id", runId).eq("organization_id", organizationId).eq("provider", "fillout");

  let offset = 0;
  let totalResponses = 0;
  let pageCount = 0;
  let apiRegion = "global";
  const normalizedRows: JsonRow[] = [];

  while (true) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort: "asc", status: "finished" });
    const response = await filloutRequest<{ responses?: JsonRow[]; totalResponses?: number; pageCount?: number }>(apiKey, `/forms/${encodeURIComponent(formId)}/submissions?${query.toString()}`);
    apiRegion = response.origin.includes("eu-api") ? "eu" : "global";
    const submissions = Array.isArray(response.data.responses) ? response.data.responses : [];
    totalResponses = Number(response.data.totalResponses || submissions.length);
    pageCount = Number(response.data.pageCount || Math.ceil(totalResponses / PAGE_SIZE));
    if (!submissions.length) break;

    const stagingRows = submissions.map((submission) => ({
      run_id: runId,
      organization_id: organizationId,
      provider: "fillout",
      external_id: text(submission.submissionId || submission.submission_id),
      payload: submission,
    })).filter((row) => row.external_id);

    for (const batch of chunks(stagingRows)) {
      const { error } = await db.from("integration_repair_staging").upsert(batch, { onConflict: "run_id,provider,external_id" });
      if (error) throw new Error(error.message);
    }

    normalizedRows.push(...submissions.map((submission) => normalizeFilloutSubmission({ ...submission, source_label: sourceLabel, form_id: formId })));
    offset += submissions.length;
    if (offset >= totalResponses || submissions.length < PAGE_SIZE) break;
  }

  const progress = await filloutRequest<{ totalResponses?: number }>(apiKey, `/forms/${encodeURIComponent(formId)}/submissions?limit=1&status=in_progress`);
  const { count, error: countError } = await db.from("integration_repair_staging").select("external_id", { count: "exact", head: true }).eq("run_id", runId).eq("organization_id", organizationId).eq("provider", "fillout");
  if (countError) throw new Error(countError.message);

  return {
    phase: "stage",
    formId,
    apiRegion,
    totalResponses,
    pageCount,
    staged: count || 0,
    inProgress: Number(progress.data.totalResponses || 0),
    withName: normalizedRows.filter((row) => text(row.name)).length,
    withEmail: normalizedRows.filter((row) => validEmail(row.email)).length,
    withPhone: normalizedRows.filter((row) => normalizePhone(row.phone).length >= 7).length,
  };
}

async function reset(organizationId: string, runId: string) {
  const db = getSupabaseAdminClient();
  const { data: leads, error: leadError } = await db.from("leads").select("*").eq("organization_id", organizationId).eq("source", "fillout").contains("payload_redacted", { verificationMode: "fillout_rest_api" });
  if (leadError) throw new Error(leadError.message);
  const realLeads = (leads || []) as JsonRow[];
  const leadIds = realLeads.map((row) => text(row.id)).filter(Boolean);
  const clientIds = Array.from(new Set(realLeads.map((row) => text(row.client_id)).filter(Boolean)));

  const { data: outbox, error: outboxError } = await db.from("integration_outbox").select("*").eq("organization_id", organizationId).eq("channel", "form").eq("event_type", "lead.created").contains("payload", { verificationMode: "fillout_rest_api" });
  if (outboxError) throw new Error(outboxError.message);
  const realOutbox = (outbox || []) as JsonRow[];

  const relatedTables = ["cases", "bookings", "billing_documents", "fiscal_documents", "communication_followups"] as const;
  const blockers: Record<string, number> = {};
  if (clientIds.length) {
    for (const table of relatedTables) {
      const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("client_id", clientIds);
      if (error) throw new Error(error.message);
      blockers[table] = count || 0;
    }
    const { data: allLinkedLeads, error } = await db.from("leads").select("id").eq("organization_id", organizationId).in("client_id", clientIds);
    if (error) throw new Error(error.message);
    blockers.other_leads = (allLinkedLeads || []).filter((row) => !leadIds.includes(text(row.id))).length;
  }
  const blockerTotal = Object.values(blockers).reduce((sum, value) => sum + value, 0);
  if (blockerTotal > 0) throw new Error(`fillout_reset_blocked:${JSON.stringify(blockers)}`);

  const { data: clients, error: clientError } = clientIds.length
    ? await db.from("clients").select("*").eq("organization_id", organizationId).in("id", clientIds)
    : { data: [], error: null };
  if (clientError) throw new Error(clientError.message);

  const { data: tasks, error: taskError } = clientIds.length
    ? await db.from("tasks").select("*").eq("organization_id", organizationId).in("client_id", clientIds)
    : { data: [], error: null };
  if (taskError) throw new Error(taskError.message);
  const repairTasks = ((tasks || []) as JsonRow[]).filter((row) => {
    const payload = row.payload && typeof row.payload === "object" ? row.payload as JsonRow : {};
    return text(payload.action_type) === "review_fillout" || leadIds.includes(text(payload.lead_id));
  });

  const { data: timeline, error: timelineError } = clientIds.length
    ? await db.from("timeline_events").select("*").eq("organization_id", organizationId).in("client_id", clientIds).eq("event_type", "fillout.received")
    : { data: [], error: null };
  if (timelineError) throw new Error(timelineError.message);
  const repairTimeline = ((timeline || []) as JsonRow[]).filter((row) => {
    const payload = row.payload && typeof row.payload === "object" ? row.payload as JsonRow : {};
    return !payload.lead_id || leadIds.includes(text(payload.lead_id));
  });

  await backupRows({ runId, organizationId, entityType: "clients", rows: (clients || []) as JsonRow[] });
  await backupRows({ runId, organizationId, entityType: "leads", rows: realLeads });
  await backupRows({ runId, organizationId, entityType: "integration_outbox", rows: realOutbox });
  await backupRows({ runId, organizationId, entityType: "tasks", rows: repairTasks });
  await backupRows({ runId, organizationId, entityType: "timeline_events", rows: repairTimeline });

  for (const [table, ids] of [
    ["tasks", repairTasks.map((row) => text(row.id))],
    ["timeline_events", repairTimeline.map((row) => text(row.id))],
    ["leads", leadIds],
    ["integration_outbox", realOutbox.map((row) => text(row.id))],
    ["clients", clientIds],
  ] as Array<[string, string[]]>) {
    for (const batch of chunks(ids.filter(Boolean))) {
      const { error } = await db.from(table).delete().eq("organization_id", organizationId).in("id", batch);
      if (error) throw new Error(error.message);
    }
  }

  return { phase: "reset", backedUp: { clients: clientIds.length, leads: leadIds.length, outbox: realOutbox.length, tasks: repairTasks.length, timeline: repairTimeline.length }, blockers };
}

async function enqueue(organizationId: string, runId: string) {
  const db = getSupabaseAdminClient();
  const { formId, sourceLabel } = await loadSettings(organizationId);
  const { data: staged, error } = await db.from("integration_repair_staging").select("external_id,payload").eq("organization_id", organizationId).eq("provider", "fillout").eq("run_id", runId).order("external_id");
  if (error) throw new Error(error.message);

  const rows = ((staged || []) as JsonRow[]).map((row) => {
    const submission = row.payload && typeof row.payload === "object" ? row.payload as JsonRow : {};
    const payload = normalizeFilloutSubmission({ ...submission, source_label: sourceLabel, form_id: formId });
    const submissionId = text(payload.submission_id || row.external_id);
    return {
      organization_id: organizationId,
      provider: "fillout",
      channel: "form",
      event_type: "lead.created",
      entity_type: "integration_event",
      idempotency_key: `fillout:${submissionId}`,
      payload: { ...payload, verificationMode: "fillout_rest_api" },
      sync_status: "pending",
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      risk: "low",
      business_rule: "Formulario externo entra primero como solicitud, nunca como expediente directo.",
      next_action: "Cualificar solicitud y deduplicar cliente.",
    };
  }).filter((row) => row.idempotency_key !== "fillout:");

  for (const batch of chunks(rows, 75)) {
    const { error: insertError } = await db.from("integration_outbox").upsert(batch, { onConflict: "organization_id,channel,event_type,idempotency_key" });
    if (insertError) throw new Error(insertError.message);
  }
  return { phase: "enqueue", queued: rows.length };
}

async function process(organizationId: string, limit: number) {
  const result = await processOutboxBatch(Math.min(75, Math.max(1, limit)));
  const db = getSupabaseAdminClient();
  const { count: pending, error } = await db.from("integration_outbox").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("channel", "form").eq("event_type", "lead.created").eq("status", "pending").contains("payload", { verificationMode: "fillout_rest_api" });
  if (error) throw new Error(error.message);
  return { phase: "process", result, pending: pending || 0 };
}

async function enrich(organizationId: string) {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("leads").select("client_id,payload_redacted,updated_at").eq("organization_id", organizationId).eq("source", "fillout").contains("payload_redacted", { verificationMode: "fillout_rest_api" }).order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);

  const byClient = new Map<string, JsonRow>();
  for (const lead of data || []) {
    const clientId = text(lead.client_id);
    const payload = lead.payload_redacted && typeof lead.payload_redacted === "object" ? lead.payload_redacted as JsonRow : {};
    if (clientId) byClient.set(clientId, payload);
  }

  const rows = Array.from(byClient.entries()).map(([id, payload]) => {
    const firstName = text(payload.first_name || payload.nombre);
    const lastName = text(payload.last_name || payload.apellidos);
    const displayName = text(payload.name) || [firstName, lastName].filter(Boolean).join(" ") || validEmail(payload.email) || text(payload.phone) || "Cliente pendiente";
    const email = validEmail(payload.email);
    const phone = text(payload.phone);
    return {
      id,
      organization_id: organizationId,
      client_type: "person",
      display_name: displayName,
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
      email_normalized: email || null,
      phone: phone || null,
      phone_normalized: normalizePhone(phone) || null,
      country: text(payload.country) || null,
      source: "fillout",
      updated_at: new Date().toISOString(),
    };
  });

  for (const batch of chunks(rows)) {
    const { error: updateError } = await db.from("clients").upsert(batch, { onConflict: "id" });
    if (updateError) throw new Error(updateError.message);
  }
  return { phase: "enrich", updatedClients: rows.length };
}

async function verify(organizationId: string, runId: string) {
  const db = getSupabaseAdminClient();
  const [{ count: staged }, { data: leads, error: leadError }, { data: clients, error: clientError }, { count: pending }] = await Promise.all([
    db.from("integration_repair_staging").select("external_id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("provider", "fillout").eq("run_id", runId),
    db.from("leads").select("id,client_id,client_name,email,phone,source_submission_id").eq("organization_id", organizationId).eq("source", "fillout").not("source_submission_id", "eq", "demo-fillout-001"),
    db.from("clients").select("id,display_name,email,phone").eq("organization_id", organizationId).eq("source", "fillout"),
    db.from("integration_outbox").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("channel", "form").eq("event_type", "lead.created").eq("status", "pending").contains("payload", { verificationMode: "fillout_rest_api" }),
  ]);
  if (leadError) throw new Error(leadError.message);
  if (clientError) throw new Error(clientError.message);
  const clientIds = new Set((leads || []).map((row) => text(row.client_id)).filter(Boolean));
  const importedClients = (clients || []).filter((row) => clientIds.has(text(row.id)));
  return {
    phase: "verify",
    staged: staged || 0,
    leads: (leads || []).length,
    uniqueSubmissions: new Set((leads || []).map((row) => text(row.source_submission_id))).size,
    clients: importedClients.length,
    pending: pending || 0,
    phoneLikeNames: importedClients.filter((row) => /^[+0-9 ()-]{7,}$/.test(text(row.display_name))).length,
    missingValidEmail: importedClients.filter((row) => !validEmail(row.email)).length,
    missingValidPhone: importedClients.filter((row) => normalizePhone(row.phone).length < 7).length,
  };
}

export async function runFilloutRepair(input: { organizationId: string; runId: string; phase: Phase; limit?: number }) {
  if (input.phase === "stage") return stage(input.organizationId, input.runId);
  if (input.phase === "reset") return reset(input.organizationId, input.runId);
  if (input.phase === "enqueue") return enqueue(input.organizationId, input.runId);
  if (input.phase === "process") return process(input.organizationId, input.limit || 50);
  if (input.phase === "enrich") return enrich(input.organizationId);
  return verify(input.organizationId, input.runId);
}
