import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { normalizeFilloutSubmission } from "@/lib/fillout-submission-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { providerIdempotencyKey } from "@/lib/webhook-security";

const FILLOUT_ORIGINS = ["https://api.fillout.com/v1/api", "https://eu-api.fillout.com/v1/api"] as const;
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 150;
const MAX_PAGES_PER_RUN = 5;

type FilloutSettings = {
  enabled: boolean;
  formId: string;
  publicUrl: string;
  sourceLabel: string;
};

type FilloutSubmissionList = {
  responses?: Record<string, unknown>[];
  totalResponses?: number;
  pageCount?: number;
};

function settingValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (value && typeof value === "object" && "value" in value) return (value as { value?: unknown }).value;
  return value;
}

export function extractFilloutFormId(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{6,}$/.test(raw) && !raw.includes(".")) return raw;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => part === "t" || part === "form");
    if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

async function loadFilloutSettings(organizationId: string): Promise<FilloutSettings> {
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
  const publicUrl = String(values.get("integrations.fillout.public_url") || "").trim();
  const configuredFormId = String(values.get("integrations.fillout.form_id") || "").trim();
  return {
    enabled: values.get("integrations.fillout.enabled") === true || values.get("integrations.fillout.enabled") === "true",
    formId: configuredFormId || extractFilloutFormId(publicUrl),
    publicUrl,
    sourceLabel: String(values.get("integrations.fillout.source_label") || "Fillout").trim() || "Fillout",
  };
}

async function filloutRequest<T>(apiKey: string, path: string): Promise<{ data: T; origin: string }> {
  let lastStatus = 500;
  let lastError = "fillout_request_failed";
  for (const origin of FILLOUT_ORIGINS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${origin}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.text();
      let parsed: unknown = null;
      try { parsed = body ? JSON.parse(body) : null; } catch { parsed = body; }
      if (response.ok) return { data: parsed as T, origin };
      lastStatus = response.status;
      const message = parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message?: unknown }).message || "")
        : typeof parsed === "string" ? parsed : "";
      lastError = message || `fillout_http_${response.status}`;
      if (![401, 403, 404].includes(response.status)) break;
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "fillout_timeout" : error instanceof Error ? error.message : "fillout_network_error";
    } finally {
      clearTimeout(timeout);
    }
  }
  const error = new Error(lastError) as Error & { status?: number };
  error.status = lastStatus;
  throw error;
}

async function requireFilloutConfiguration(organizationId: string) {
  const settings = await loadFilloutSettings(organizationId);
  if (!settings.enabled) throw new Error("fillout_integration_disabled");
  if (!settings.formId) throw new Error("fillout_form_id_missing");
  // Compatibility: this encrypted slot was previously labelled as the webhook token.
  // From this release it stores the Fillout REST API key; the value never reaches the browser again after saving.
  const apiKey = await getOrganizationSecret(organizationId, "fillout_webhook_secret");
  if (!apiKey) throw new Error("fillout_api_key_not_configured");
  return { settings, apiKey };
}

export async function testFilloutConnection(organizationId: string) {
  try {
    const { settings, apiKey } = await requireFilloutConfiguration(organizationId);
    const metadata = await filloutRequest<Record<string, unknown>>(apiKey, `/forms/${encodeURIComponent(settings.formId)}`);
    const submissions = await filloutRequest<FilloutSubmissionList>(apiKey, `/forms/${encodeURIComponent(settings.formId)}/submissions?limit=1&sort=desc`);
    return {
      ok: true as const,
      status: 200,
      formId: settings.formId,
      formName: String(metadata.data.name || metadata.data.title || settings.sourceLabel),
      totalResponses: Number(submissions.data.totalResponses || 0),
      apiRegion: metadata.origin.includes("eu-api") ? "eu" : "global",
    };
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status || 424) : 424;
    const raw = error instanceof Error ? error.message : "fillout_connection_failed";
    const message = raw.includes("401") || status === 401
      ? "La API Key de Fillout no es válida, está revocada o pertenece a otra cuenta."
      : raw.includes("403") || status === 403
        ? "La API Key no tiene permiso para consultar este formulario."
        : raw.includes("404") || status === 404
          ? "Fillout no encuentra el formulario indicado. Revisa la URL o el ID."
          : raw === "fillout_api_key_not_configured"
            ? "Guarda primero la API Key de Fillout."
            : raw === "fillout_integration_disabled"
              ? "Activa Fillout antes de probar la conexión."
              : raw === "fillout_form_id_missing"
                ? "No se ha podido obtener el ID del formulario desde la URL."
                : raw === "fillout_timeout"
                  ? "Fillout no respondió dentro del tiempo esperado."
                  : raw;
    return { ok: false as const, status: Number.isFinite(status) && status >= 400 ? status : 424, error: message };
  }
}

async function lastImportedSubmissionTime(organizationId: string) {
  const { data } = await getSupabaseAdminClient()
    .from("integration_outbox")
    .select("payload,created_at")
    .eq("organization_id", organizationId)
    .eq("channel", "form")
    .eq("event_type", "lead.created")
    .order("created_at", { ascending: false })
    .limit(20);
  const times = (data || [])
    .map((row) => {
      const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
      return String(payload.submitted_at || payload.submissionTime || "");
    })
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  if (!times[0]) return null;
  return new Date(times[0].getTime() - 5 * 60 * 1000).toISOString();
}

export async function syncFilloutSubmissions(organizationId: string, options: { full?: boolean; maxPages?: number } = {}) {
  const { settings, apiKey } = await requireFilloutConfiguration(organizationId);
  const afterDate = options.full ? null : await lastImportedSubmissionTime(organizationId);
  const maxPages = Math.min(20, Math.max(1, options.maxPages || MAX_PAGES_PER_RUN));
  let fetched = 0;
  let queued = 0;
  let duplicates = 0;
  let failed = 0;
  let totalResponses = 0;
  let pageCount = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE), sort: "asc" });
    if (afterDate) query.set("afterDate", afterDate);
    const response = await filloutRequest<FilloutSubmissionList>(apiKey, `/forms/${encodeURIComponent(settings.formId)}/submissions?${query.toString()}`);
    const submissions = Array.isArray(response.data.responses) ? response.data.responses : [];
    totalResponses = Number(response.data.totalResponses || submissions.length);
    pageCount = Number(response.data.pageCount || Math.ceil(totalResponses / PAGE_SIZE));
    fetched += submissions.length;

    for (const submission of submissions) {
      const payload = normalizeFilloutSubmission({ ...submission, source_label: settings.sourceLabel, form_id: settings.formId });
      const submissionId = String(payload.submission_id || "").trim();
      if (!submissionId) { failed += 1; continue; }
      const rawBody = JSON.stringify(submission);
      const result = await enqueueOutboxEvent({
        organizationId,
        channel: "form",
        eventType: "lead.created",
        payload: { ...payload, verificationMode: "fillout_rest_api" },
        risk: "low",
        businessRule: "Formulario externo entra primero como solicitud, nunca como expediente directo.",
        nextAction: "Cualificar solicitud y deduplicar cliente.",
        idempotencyKey: providerIdempotencyKey({ channel: "form", eventType: "lead.created", payload, fallbackRawBody: rawBody, eventId: submissionId }),
      });
      if (!result.ok) failed += 1;
      else if (result.duplicate) duplicates += 1;
      else queued += 1;
    }

    if (submissions.length < PAGE_SIZE || page + 1 >= pageCount) break;
  }

  const processing = queued > 0 ? await processOutboxBatch(Math.min(100, Math.max(25, queued))) : null;
  return {
    ok: failed === 0,
    formId: settings.formId,
    afterDate,
    fetched,
    queued,
    duplicates,
    failed,
    totalResponses,
    pageCount,
    capped: pageCount > maxPages,
    processing,
  };
}

export async function syncFilloutForAllOrganizations() {
  const { data: organizations, error } = await getSupabaseAdminClient().from("organizations").select("id");
  if (error) throw new Error(error.message);
  const results = [];
  for (const organization of organizations || []) {
    const organizationId = String(organization.id);
    try {
      const settings = await loadFilloutSettings(organizationId);
      if (!settings.enabled) {
        results.push({ organizationId, ok: true, skipped: true, reason: "disabled" });
        continue;
      }
      results.push({ organizationId, ...(await syncFilloutSubmissions(organizationId)) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "fillout_sync_failed";
      if (message === "fillout_api_key_not_configured") results.push({ organizationId, ok: true, skipped: true, reason: message });
      else results.push({ organizationId, ok: false, error: message });
    }
  }
  return { organizations: results.length, failedOrganizations: results.filter((item) => !item.ok).length, results };
}
