import { normalizeFilloutSubmission } from "@/lib/fillout-submission-server";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const FILLOUT_ORIGINS = ["https://api.fillout.com/v1/api", "https://eu-api.fillout.com/v1/api"] as const;
const PAGE_SIZE = 150;
const MAX_PAGES = 20;

type JsonRow = Record<string, unknown>;

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
  return { formId, sourceLabel: text(values.get("integrations.fillout.source_label")) || "Fillout" };
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

export async function stageFilloutRepair(organizationId: string, runId: string) {
  const db = getSupabaseAdminClient();
  const [{ formId, sourceLabel }, apiKey] = await Promise.all([
    loadSettings(organizationId),
    getOrganizationSecret(organizationId, "fillout_webhook_secret"),
  ]);
  if (!apiKey) throw new Error("fillout_api_key_not_configured");

  await db.from("integration_repair_staging").delete().eq("run_id", runId).eq("organization_id", organizationId).eq("provider", "fillout");

  let offset = 0;
  let apiRegion = "global";
  let reportedTotal = 0;
  let reportedPageCount = 0;
  let pagesFetched = 0;
  const normalizedRows: JsonRow[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort: "asc" });
    const response = await filloutRequest<{ responses?: JsonRow[]; totalResponses?: number; pageCount?: number }>(apiKey, `/forms/${encodeURIComponent(formId)}/submissions?${query.toString()}`);
    apiRegion = response.origin.includes("eu-api") ? "eu" : "global";
    reportedTotal = Math.max(reportedTotal, Number(response.data.totalResponses || 0));
    reportedPageCount = Math.max(reportedPageCount, Number(response.data.pageCount || 0));
    const submissions = Array.isArray(response.data.responses) ? response.data.responses : [];
    if (!submissions.length) break;
    pagesFetched += 1;

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
    if (submissions.length < PAGE_SIZE) break;
  }

  const { count, error: countError } = await db.from("integration_repair_staging").select("external_id", { count: "exact", head: true }).eq("run_id", runId).eq("organization_id", organizationId).eq("provider", "fillout");
  if (countError) throw new Error(countError.message);
  const staged = count || 0;
  if (pagesFetched >= MAX_PAGES && staged === MAX_PAGES * PAGE_SIZE) throw new Error("fillout_pagination_safety_cap_reached");

  return {
    phase: "stage",
    formId,
    apiRegion,
    reportedTotal,
    reportedPageCount,
    pagesFetched,
    staged,
    withName: normalizedRows.filter((row) => text(row.name)).length,
    withEmail: normalizedRows.filter((row) => validEmail(row.email)).length,
    withPhone: normalizedRows.filter((row) => normalizePhone(row.phone).length >= 7).length,
  };
}
