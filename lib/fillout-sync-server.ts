import { enqueueOutboxEvent, providerIdempotencyKey } from "@/lib/integration-outbox-server";
import { loadFilloutSettings } from "@/lib/fillout-api-server";
import { normalizeFilloutSubmission } from "@/lib/fillout-submission-server";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const FILLOUT_ORIGINS = ["https://api.fillout.com/v1/api", "https://eu-api.fillout.com/v1/api"] as const;
const PAGE_SIZE = 150;
const DEFAULT_MAX_PAGES = 20;
const ENQUEUE_CONCURRENCY = 20;
const MAX_PROCESSING_ROUNDS = 10;

type JsonRow = Record<string, unknown>;
type SubmissionList = { responses?: JsonRow[]; totalResponses?: number; pageCount?: number };

function text(value: unknown) {
  return String(value || "").trim();
}

function chunks<T>(rows: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
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
  if (!submissionId) return { duplicate: false, skipped: true };
  const result = await enqueueOutboxEvent({
    organizationId,
    provider: "fillout",
    channel: "form",
    eventType: "lead.created",
    entityType: "integration_event",
    idempotencyKey: providerIdempotencyKey("fillout", submissionId),
    payload: { ...normalized, verificationMode: "fillout_rest_api" },
    risk: "low",
    businessRule: "Formulario externo entra primero como solicitud, nunca como expediente directo.",
    nextAction: "Cualificar solicitud y deduplicar cliente.",
  });
  return { duplicate: Boolean(result.duplicate), skipped: false };
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
  const settings = await loadFilloutSettings(organizationId);
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
        if (result.status === "rejected") {
          failed += 1;
        } else if (result.value.skipped) {
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
    ok: failed === 0,
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
