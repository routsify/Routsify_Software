import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { normalizeFilloutSubmission } from "@/lib/fillout-submission-server";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { providerIdempotencyKey } from "@/lib/webhook-security";

const FILLOUT_ORIGINS = ["https://api.fillout.com/v1/api", "https://eu-api.fillout.com/v1/api"] as const;
const PAGE_SIZE = 150;
const DEFAULT_MAX_PAGES = 20;
const ENQUEUE_CONCURRENCY = 20;
const MAX_PROCESSING_ROUNDS = 10;

type JsonRow = Record<string, unknown>;
type SubmissionList = { responses?: JsonRow[]; totalResponses?: number; pageCount?: number };
type FilloutSettings = { enabled: boolean; formId: string; publicUrl: string; sourceLabel: string };

function text(value: unknown) {
  return String(value || "").trim();
}

function settingValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (value && typeof value === "object" && "value" in value) return (value as JsonRow).value;
  return value;
}

function extractFormId(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{6,}$/.test(raw) && !raw.includes(".")) return raw;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => part === "t" || part === "form");
    return marker >= 0 && parts[marker + 1] ? parts[marker + 1] : parts.at(-1) || "";
  } catch {
    return "";
  }
}

function chunks<T>(rows: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

async function loadSettings(organizationId: string): Promise<FilloutSettings> {
  const keys = [
    "integrations.fillout.enabled",
    "integrations.fillout.form_id",
    "integrations.fillout.public_url",
    "integrations.fillout.source_label",
  ];
  const { data, error } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value")
    .eq("organization_id", organizationId)
    .in("key", keys);
  if (error) throw new Error(error.message);
  const values = new Map((data || []).map((row) => [String(row.key), settingValue(row.value)]));
  const publicUrl = text(values.get("integrations.fillout.public_url"));
  const configuredFormId = text(values.get("integrations.fillout.form_id"));
  return {
    enabled: values.get("integrations.fillout.enabled") === true || values.get("integrations.fillout.enabled") === "true",
    formId: configuredFormId || extractFormId(publicUrl),
    publicUrl,
    sourceLabel: text(values.get("integrations.fillout.source_label")) || "Fillout",
  };
}

async function filloutRequest<T>(apiKey: string, path: string): Promise<{ data: T; origin: string }> {
  let lastError = "fillout_request_failed";
  for (const origin of FILLOUT_ORIGINS) {
    const response = await fetch(`${origin}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    const raw = await response.text();
    let parsed: unknown = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
    if (response.ok) return { data: parsed as T, origin };
    lastError = parsed && typeof parsed === "object" && "message" in parsed
      ? text((parsed as JsonRow).message)
      : `fillout_http_${response.status}`;
    if (![401, 403, 404].includes(response.status)) break;
  }
  throw new Error(lastError);
}

async function latestSubmittedAt(organizationId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("integration_outbox")
    .select("payload")
    .eq("organization_id", organizationId)
    .eq("channel", "form")
    .eq("event_type", "lead.created")
    .contains("payload", { verificationMode: "fillout_rest_api" })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const payload = data?.payload && typeof data.payload === "object" ? data.payload as JsonRow : {};
  return text(payload.submitted_at || payload.submissionTime || payload.submission_time);
}

async function enqueueSubmission(organizationId: string, submission: JsonRow, formId: string, sourceLabel: string) {
  const normalized = normalizeFilloutSubmission({ ...submission, form_id: formId, source_label: sourceLabel });
  const submissionId = text(normalized.submission_id || submission.submissionId || submission.submission_id);
  if (!submissionId) return { ok: false, duplicate: false, skipped: true };
  const payload = { ...normalized, verificationMode: "fillout_rest_api" };
  const result = await enqueueOutboxEvent({
    organizationId,
    channel: "form",
    eventType: "lead.created",
    idempotencyKey: providerIdempotencyKey({
      channel: "fillout",
      eventType: "lead.created",
      payload,
      fallbackRawBody: JSON.stringify(submission),
      eventId: submissionId,
    }),
    payload,
    risk: "low",
    businessRule: "Formulario externo entra primero como solicitud, nunca como expediente directo.",
    nextAction: "Cualificar solicitud y deduplicar cliente.",
  });
  return {
    ok: result.ok,
    duplicate: Boolean("duplicate" in result && result.duplicate),
    skipped: Boolean("skipped" in result && result.skipped),
  };
}

async function pendingFilloutCount(organizationId: string) {
  const { count, error } = await getSupabaseAdminClient()
    .from("integration_outbox")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("channel", "form")
    .eq("event_type", "lead.created")
    .eq("status", "pending")
    .contains("payload", { verificationMode: "fillout_rest_api" });
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function syncFilloutSubmissionsV2(organizationId: string, options: { full?: boolean; maxPages?: number } = {}) {
  const settings = await loadSettings(organizationId);
  if (!settings.enabled) return { ok: true as const, skipped: true as const, reason: "fillout_integration_disabled", fetched: 0, queued: 0, duplicates: 0, failed: 0, remaining: 0 };
  if (!settings.formId) throw new Error("fillout_form_id_missing");
  const apiKey = await getOrganizationSecret(organizationId, "fillout_webhook_secret");
  if (!apiKey) throw new Error("fillout_api_key_not_configured");

  const maxPages = Math.min(100, Math.max(1, Number(options.maxPages || DEFAULT_MAX_PAGES)));
  const afterDate = options.full ? "" : await latestSubmittedAt(organizationId);
  let offset = 0;
  let fetched = 0;
  let queued = 0;
  let duplicates = 0;
  let failed = 0;
  let pagesFetched = 0;
  let reportedTotal = 0;
  let apiRegion = "global";

  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort: "asc" });
    if (afterDate) query.set("afterDate", afterDate);
    const response = await filloutRequest<SubmissionList>(apiKey, `/forms/${encodeURIComponent(settings.formId)}/submissions?${query.toString()}`);
    apiRegion = response.origin.includes("eu-api") ? "eu" : "global";
    reportedTotal = Math.max(reportedTotal, Number(response.data.totalResponses || 0));
    const submissions = Array.isArray(response.data.responses) ? response.data.responses : [];
    if (!submissions.length) break;
    pagesFetched += 1;
    fetched += submissions.length;

    for (const batch of chunks(submissions, ENQUEUE_CONCURRENCY)) {
      const results = await Promise.allSettled(batch.map((submission) => enqueueSubmission(organizationId, submission, settings.formId, settings.sourceLabel)));
      for (const result of results) {
        if (result.status === "rejected" || !result.value.ok || result.value.skipped && !result.value.duplicate) {
          failed += 1;
        } else if (result.value.duplicate) {
          duplicates += 1;
        } else {
          queued += 1;
        }
      }
    }

    offset += submissions.length;
    if (submissions.length < PAGE_SIZE) break;
  }

  let processingRounds = 0;
  let remaining = await pendingFilloutCount(organizationId);
  while (remaining > 0 && processingRounds < MAX_PROCESSING_ROUNDS) {
    await processOutboxBatch(Math.min(100, remaining));
    processingRounds += 1;
    remaining = await pendingFilloutCount(organizationId);
  }

  return {
    ok: failed === 0 && remaining === 0,
    skipped: false as const,
    fetched,
    queued,
    duplicates,
    failed,
    remaining,
    pagesFetched,
    reportedTotal,
    apiRegion,
    afterDate: afterDate || null,
    processingRounds,
  };
}

export async function syncFilloutForAllOrganizationsV2() {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("organizations").select("id").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const results: Array<{ organizationId: string; ok: boolean; data?: unknown; error?: string }> = [];
  for (const organization of data || []) {
    const organizationId = text(organization.id);
    if (!organizationId) continue;
    try {
      const result = await syncFilloutSubmissionsV2(organizationId, { full: false, maxPages: 10 });
      results.push({ organizationId, ok: result.ok, data: result, error: result.ok ? undefined : "fillout_sync_partial_failure" });
    } catch (error) {
      results.push({ organizationId, ok: false, error: error instanceof Error ? error.message : "fillout_sync_failed" });
    }
  }
  const failedOrganizations = results.filter((result) => !result.ok).length;
  return {
    ok: failedOrganizations === 0,
    organizations: results.length,
    failedOrganizations,
    results,
  };
}
