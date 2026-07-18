import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { normalizeFilloutSubmission } from "@/lib/fillout-normalizer";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const DEFAULT_API_BASE_URL = "https://api.fillout.com/v1/api";
const DEFAULT_FORM_URL = "https://routsify.fillout.com/t/itUeh5jZBXus";
const DEFAULT_FORM_ID = "itUeh5jZBXus";
const ALLOWED_API_HOSTS = new Set(["api.fillout.com", "eu-api.fillout.com"]);

export type FilloutApiConfig = {
  enabled: boolean;
  apiBaseUrl: string;
  publicFormUrl: string;
  formId: string;
  sourceLabel: string;
  lastSyncAt: string | null;
};

type FilloutMetadata = {
  id?: string;
  name?: string;
  questions?: Array<{ id?: string; name?: string; type?: string }>;
  calculations?: Array<{ id?: string; name?: string }>;
  urlParameters?: Array<{ id?: string; name?: string }>;
};

type FilloutSubmission = Record<string, unknown> & {
  submissionId?: string;
  submissionTime?: string;
  lastUpdatedAt?: string;
};

type FilloutSubmissionPage = {
  responses?: FilloutSubmission[];
  totalResponses?: number;
  pageCount?: number;
};

function settingText(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim() || fallback;
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return String((value as { value?: unknown }).value || "").trim() || fallback;
  }
  return fallback;
}

function settingBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === "boolean" ? nested : fallback;
  }
  return fallback;
}

export function parseFilloutFormId(value: string) {
  const input = value.trim();
  if (!input) return "";
  if (/^[A-Za-z0-9_-]{6,}$/.test(input) && !input.includes(".")) return input;
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    const tIndex = parts.indexOf("t");
    const candidate = tIndex >= 0 ? parts[tIndex + 1] : parts.at(-1);
    return candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

function normalizeApiBaseUrl(value: string) {
  const candidate = (value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
  const url = new URL(candidate);
  if (url.protocol !== "https:" || !ALLOWED_API_HOSTS.has(url.hostname)) throw new Error("invalid_fillout_api_base_url");
  if (!url.pathname.endsWith("/v1/api")) throw new Error("fillout_api_base_must_end_v1_api");
  return url.toString().replace(/\/$/, "");
}

export async function loadFilloutApiConfig(organizationId: string): Promise<FilloutApiConfig> {
  const keys = [
    "integrations.fillout.enabled",
    "integrations.fillout.api_base_url",
    "integrations.fillout.public_url",
    "integrations.fillout.form_id",
    "integrations.fillout.source_label",
    "integrations.fillout.last_sync_at",
  ];
  const { data, error } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value")
    .eq("organization_id", organizationId)
    .in("key", keys);
  if (error) throw new Error(error.message);
  const rows = new Map((data || []).map((row) => [String(row.key), row.value]));
  const publicFormUrl = settingText(rows.get("integrations.fillout.public_url"), DEFAULT_FORM_URL);
  const formId = settingText(rows.get("integrations.fillout.form_id")) || parseFilloutFormId(publicFormUrl) || DEFAULT_FORM_ID;
  return {
    enabled: settingBoolean(rows.get("integrations.fillout.enabled"), false),
    apiBaseUrl: normalizeApiBaseUrl(settingText(rows.get("integrations.fillout.api_base_url"), DEFAULT_API_BASE_URL)),
    publicFormUrl,
    formId,
    sourceLabel: settingText(rows.get("integrations.fillout.source_label"), "Fillout"),
    lastSyncAt: settingText(rows.get("integrations.fillout.last_sync_at")) || null,
  };
}

async function filloutRequest<T>(input: {
  organizationId: string;
  path: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}) {
  const [apiKey, config] = await Promise.all([
    getOrganizationSecret(input.organizationId, "fillout_api_key"),
    loadFilloutApiConfig(input.organizationId),
  ]);
  if (!apiKey) return { ok: false as const, status: 503, error: "fillout_api_key_not_configured", config, data: null };
  if (!config.formId) return { ok: false as const, status: 400, error: "fillout_form_id_required", config, data: null };

  const url = new URL(`${config.apiBaseUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`);
  for (const [key, value] of Object.entries(input.searchParams || {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(30_000, Math.max(2_000, input.timeoutMs || 15_000)));
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "User-Agent": "Routsify-Software/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) return { ok: false as const, status: response.status, error: `fillout_http_${response.status}`, config, data };
    return { ok: true as const, status: response.status, config, data: data as T };
  } catch (error) {
    return { ok: false as const, status: 504, error: error instanceof Error && error.name === "AbortError" ? "fillout_timeout" : "fillout_network_error", config, data: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function testFilloutApi(organizationId: string) {
  const config = await loadFilloutApiConfig(organizationId);
  const result = await filloutRequest<FilloutMetadata>({ organizationId, path: `/forms/${encodeURIComponent(config.formId)}` });
  if (!result.ok) return result;
  const metadata = result.data || {};
  return {
    ok: true as const,
    status: result.status,
    formId: String(metadata.id || config.formId),
    formName: String(metadata.name || "Formulario Fillout"),
    questionCount: Array.isArray(metadata.questions) ? metadata.questions.length : 0,
    calculationCount: Array.isArray(metadata.calculations) ? metadata.calculations.length : 0,
    publicFormUrl: config.publicFormUrl,
  };
}

async function saveSyncState(input: {
  organizationId: string;
  formName: string;
  questionCount: number;
  syncedAt: string;
  imported: number;
}) {
  const rows = [
    ["integrations.fillout.last_sync_at", input.syncedAt, "string"],
    ["integrations.fillout.form_name", input.formName, "string"],
    ["integrations.fillout.question_count", input.questionCount, "number"],
    ["integrations.fillout.last_sync_count", input.imported, "number"],
  ].map(([key, value, valueType]) => ({
    organization_id: input.organizationId,
    module: "integrations",
    key,
    value,
    default_value: value,
    value_type: valueType,
    scope: "global",
    editable: false,
    requires_recalculation: false,
    affected_modules: ["clients", "leads", "integrations"],
    updated_at: input.syncedAt,
  }));
  const { error } = await getSupabaseAdminClient().from("routsify_settings").upsert(rows, { onConflict: "organization_id,key" });
  if (error) throw new Error(error.message);
}

export async function syncFilloutSubmissions(organizationId: string, options?: { fullSync?: boolean; maxPages?: number }) {
  const connection = await testFilloutApi(organizationId);
  if (!connection.ok) return connection;
  const config = await loadFilloutApiConfig(organizationId);
  if (!config.enabled) return { ok: false as const, status: 409, error: "fillout_integration_disabled" };

  const limit = 150;
  const maxPages = Math.min(20, Math.max(1, options?.maxPages || 10));
  const afterDate = !options?.fullSync && config.lastSyncAt
    ? new Date(Math.max(0, new Date(config.lastSyncAt).getTime() - 5 * 60 * 1000)).toISOString()
    : undefined;
  let offset = 0;
  let fetched = 0;
  let queued = 0;
  let duplicates = 0;
  let failed = 0;
  let newestTimestamp = config.lastSyncAt || "";

  for (let page = 0; page < maxPages; page += 1) {
    const result = await filloutRequest<FilloutSubmissionPage>({
      organizationId,
      path: `/forms/${encodeURIComponent(config.formId)}/submissions`,
      searchParams: { limit, offset, sort: "asc", afterDate, includeEditLink: true },
      timeoutMs: 20_000,
    });
    if (!result.ok) return { ...result, fetched, queued, duplicates, failed };
    const responses = Array.isArray(result.data?.responses) ? result.data.responses : [];
    if (!responses.length) break;

    for (const submission of responses) {
      fetched += 1;
      const submissionId = String(submission.submissionId || "").trim();
      if (!submissionId) { failed += 1; continue; }
      const normalized = normalizeFilloutSubmission(submission, {
        source: config.sourceLabel || "Fillout",
        formId: config.formId,
        formName: connection.formName,
      });
      const enqueue = await enqueueOutboxEvent({
        organizationId,
        channel: "form",
        eventType: "lead.created",
        payload: { ...normalized, verificationMode: "fillout_rest_api" },
        risk: "low",
        businessRule: "La respuesta de Fillout entra como solicitud y nunca crea un expediente automáticamente.",
        nextAction: "Revisar la solicitud y deduplicar el cliente.",
        idempotencyKey: `fillout-api:${config.formId}:${submissionId}`,
      });
      if (!enqueue.ok) failed += 1;
      else if (enqueue.duplicate || enqueue.skipped) duplicates += 1;
      else queued += 1;
      const timestamp = String(submission.lastUpdatedAt || submission.submissionTime || "");
      if (timestamp && timestamp > newestTimestamp) newestTimestamp = timestamp;
    }

    offset += responses.length;
    const total = Number(result.data?.totalResponses || 0);
    if (responses.length < limit || (total > 0 && offset >= total)) break;
  }

  const processing = queued ? await processOutboxBatch(Math.min(200, Math.max(25, queued))) : null;
  const syncedAt = newestTimestamp || new Date().toISOString();
  await saveSyncState({
    organizationId,
    formName: connection.formName,
    questionCount: connection.questionCount,
    syncedAt,
    imported: queued,
  });
  return {
    ok: true as const,
    status: 200,
    formId: config.formId,
    formName: connection.formName,
    fetched,
    queued,
    duplicates,
    failed,
    lastSyncAt: syncedAt,
    processing,
  };
}

export async function syncFilloutForAllOrganizations() {
  const { data, error } = await getSupabaseAdminClient().from("organizations").select("id");
  if (error) throw new Error(error.message);
  const results = [];
  for (const organization of data || []) {
    const organizationId = String(organization.id);
    try {
      const config = await loadFilloutApiConfig(organizationId);
      const apiKey = await getOrganizationSecret(organizationId, "fillout_api_key");
      if (!config.enabled || !apiKey) continue;
      results.push({ organizationId, ...(await syncFilloutSubmissions(organizationId)) });
    } catch (error) {
      results.push({ organizationId, ok: false, error: error instanceof Error ? error.message : "fillout_sync_failed" });
    }
  }
  return { organizations: results.length, failedOrganizations: results.filter((item) => !item.ok).length, results };
}
