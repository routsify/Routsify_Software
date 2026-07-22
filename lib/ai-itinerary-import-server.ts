import { createHash, randomUUID } from "node:crypto";
import { sanitizeFileName } from "@/lib/api-security";
import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { DEFAULT_ITINERARY_AI_PROMPT } from "@/lib/settings-master";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const AI_ITINERARY_BUCKET = "ai-itinerary-imports";
export const AI_ITINERARY_MAX_BYTES = 15 * 1024 * 1024;

const serviceTypeCodes = ["flight", "accommodation", "transfer", "rail", "ferry", "rental_car", "insurance", "activity", "esim", "visa", "fees", "custom"] as const;
const requirementLevels = ["required", "conditional", "optional"] as const;

type ServiceTypeCode = (typeof serviceTypeCodes)[number];
type RequirementLevel = (typeof requirementLevels)[number];
type JsonRow = Record<string, unknown>;

export type AiItineraryRow = {
  rowNumber: number;
  service_type_code: ServiceTypeCode;
  description_public: string;
  description_internal: string;
  supplier_id: string;
  supplier_name: string;
  destination_segment: string;
  start_date: string;
  end_date: string;
  cost_budget: string;
  margin_applied: string;
  sale_price: string;
  creates_expected_purchase: boolean;
  included: boolean;
  requirement_level: RequirementLevel;
  source_reference: string;
  ai_generated: boolean;
  ai_confidence: number;
};

function text(value: unknown, max = 1000) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function confidence(value: unknown) {
  const numeric = Number(value);
  return Math.max(0, Math.min(Number.isFinite(numeric) ? numeric : 0, 1));
}

function date(value: unknown) {
  const normalized = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function outputText(payload: JsonRow) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as JsonRow).content) ? (item as JsonRow).content as unknown[] : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as JsonRow).text === "string") return String((part as JsonRow).text);
    }
  }
  return "";
}

function providerError(payload: JsonRow, response: Response) {
  const error = payload.error && typeof payload.error === "object" ? payload.error as JsonRow : {};
  return {
    code: text(error.code || error.type || `openai_http_${response.status}`, 120),
    requestId: text(response.headers.get("x-request-id"), 120) || null,
  };
}

export function validateItineraryPdf(input: { fileName?: unknown; sizeBytes?: unknown; mimeType?: unknown }) {
  const fileName = String(input.fileName || "").trim();
  const sizeBytes = Number(input.sizeBytes || 0);
  const mimeType = String(input.mimeType || "").trim().toLowerCase();
  if (!fileName.toLowerCase().endsWith(".pdf") || sanitizeFileName(fileName).length < 5) return "itinerary_pdf_required";
  if (mimeType && mimeType !== "application/pdf") return "itinerary_pdf_required";
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > AI_ITINERARY_MAX_BYTES) return "invalid_itinerary_pdf_size";
  return null;
}

async function editableVersion(input: { organizationId: string; proposalId: string; versionId: string }) {
  const { data, error } = await getSupabaseAdminClient()
    .from("proposals")
    .select("id,case_id,status,current_version_id,proposal_versions!proposals_current_version_fk(id,status,locked)")
    .eq("id", input.proposalId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("proposal_not_found");
  const current = Array.isArray(data.proposal_versions) ? data.proposal_versions[0] : data.proposal_versions;
  if (data.current_version_id !== input.versionId || current?.id !== input.versionId) throw new Error("proposal_version_is_not_selected");
  if (!["draft", "internal_review"].includes(String(data.status || "")) || current?.locked || !["draft", "internal_review"].includes(String(current?.status || ""))) throw new Error("proposal_version_locked");
  return { caseId: String(data.case_id) };
}

export async function createAiItineraryUploadUrl(input: { organizationId: string; proposalId: string; versionId: string; fileName: string; sizeBytes: number; mimeType: string }) {
  const validationError = validateItineraryPdf(input);
  if (validationError) return { ok: false as const, error: validationError };
  await editableVersion(input);
  const safeName = sanitizeFileName(input.fileName);
  const path = `${input.organizationId}/${input.proposalId}/${input.versionId}/${Date.now()}-${randomUUID()}-${safeName}`;
  const { data, error } = await getSupabaseAdminClient().storage.from(AI_ITINERARY_BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, bucket: AI_ITINERARY_BUCKET, path, signedUrl: data.signedUrl, token: data.token, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
}

function normalizeServices(raw: unknown) {
  const source = raw && typeof raw === "object" ? raw as JsonRow : {};
  const warnings = Array.isArray(source.warnings) ? source.warnings.map((item) => text(item, 500)).filter(Boolean).slice(0, 50) : [];
  const summary = text(source.document_summary, 1000);
  const inputServices = Array.isArray(source.services) ? source.services : [];
  const dedupe = new Set<string>();
  const rows: AiItineraryRow[] = [];

  for (const item of inputServices.slice(0, 240)) {
    if (!item || typeof item !== "object") continue;
    const service = item as JsonRow;
    const description = text(service.description_public, 500);
    if (description.length < 2) continue;
    const requestedType = text(service.service_type_code, 40) as ServiceTypeCode;
    const serviceType = serviceTypeCodes.includes(requestedType) ? requestedType : "custom";
    const requestedRequirement = text(service.requirement_level, 40) as RequirementLevel;
    const requirement = requirementLevels.includes(requestedRequirement) ? requestedRequirement : "required";
    const startDate = date(service.start_date);
    const endDate = date(service.end_date);
    const key = [serviceType, description.toLocaleLowerCase("es-ES"), startDate, endDate].join("|");
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    rows.push({
      rowNumber: rows.length + 1,
      service_type_code: serviceType,
      description_public: description,
      description_internal: text(service.description_internal, 1500),
      supplier_id: "",
      supplier_name: "",
      destination_segment: text(service.destination_segment, 200),
      start_date: startDate,
      end_date: endDate && (!startDate || endDate >= startDate) ? endDate : "",
      cost_budget: "0",
      margin_applied: "",
      sale_price: "",
      creates_expected_purchase: service.creates_expected_purchase !== false,
      included: service.included === true,
      requirement_level: requirement,
      source_reference: text(service.source_reference, 500),
      ai_generated: true,
      ai_confidence: confidence(service.confidence),
    });
    if (rows.length >= 200) break;
  }

  if (inputServices.length > rows.length && rows.length === 200) warnings.push("La salida alcanzó el límite de 200 servicios; revisa si conviene dividir el documento.");
  return { rows, warnings: [...new Set(warnings)], summary };
}

export async function analyzeAiItinerary(input: { organizationId: string; proposalId: string; versionId: string; storagePath: string; fileName: string; sizeBytes: number; actorId: string | null }) {
  const validationError = validateItineraryPdf({ fileName: input.fileName, sizeBytes: input.sizeBytes, mimeType: "application/pdf" });
  if (validationError) throw new Error(validationError);
  const expectedPrefix = `${input.organizationId}/${input.proposalId}/${input.versionId}/`;
  if (!input.storagePath.startsWith(expectedPrefix) || input.storagePath.includes("..")) throw new Error("invalid_ai_import_path");
  const { caseId } = await editableVersion(input);
  const db = getSupabaseAdminClient();
  const { data: file, error: downloadError } = await db.storage.from(AI_ITINERARY_BUCKET).download(input.storagePath);
  if (downloadError || !file) throw new Error(downloadError?.message || "ai_import_file_not_found");
  if (file.size <= 0 || file.size > AI_ITINERARY_MAX_BYTES) throw new Error("invalid_itinerary_pdf_size");

  try {
  const [apiKey, settings] = await Promise.all([
    getOrganizationSecret(input.organizationId, "openai_api_key"),
    loadEffectiveSettings(input.organizationId),
  ]);
  if (!apiKey) throw new Error("openai_api_key_not_configured");
  const model = settings.string("ai.itinerary.model", "gpt-5.6-terra").trim() || "gpt-5.6-terra";
  const prompt = settings.string("ai.itinerary.prompt", DEFAULT_ITINERARY_AI_PROMPT).trim() || DEFAULT_ITINERARY_AI_PROMPT;
  const bytes = Buffer.from(await file.arrayBuffer());
  const fileSha256 = createHash("sha256").update(bytes).digest("hex");
  const promptSha256 = createHash("sha256").update(prompt).digest("hex");
  const { data: run, error: runError } = await db.from("ai_import_runs").insert({
    organization_id: input.organizationId,
    case_id: caseId,
    proposal_id: input.proposalId,
    proposal_version_id: input.versionId,
    model,
    status: "processing",
    file_name: sanitizeFileName(input.fileName),
    file_sha256: fileSha256,
    prompt_sha256: promptSha256,
    created_by: input.actorId,
  }).select("id").single();
  if (runError) throw new Error(runError.message);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 110_000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: 24000,
          input: [{ role: "user", content: [
            { type: "input_text", text: prompt },
            { type: "input_file", filename: sanitizeFileName(input.fileName), file_data: `data:application/pdf;base64,${bytes.toString("base64")}` },
          ] }],
          text: { format: { type: "json_schema", name: "routsify_itinerary_services", strict: true, schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              document_summary: { type: "string" },
              warnings: { type: "array", items: { type: "string" } },
              services: { type: "array", items: { type: "object", additionalProperties: false, properties: {
                service_type_code: { type: "string", enum: [...serviceTypeCodes] },
                description_public: { type: "string" },
                description_internal: { type: "string" },
                destination_segment: { type: "string" },
                start_date: { type: ["string", "null"] },
                end_date: { type: ["string", "null"] },
                requirement_level: { type: "string", enum: [...requirementLevels] },
                included: { type: "boolean" },
                creates_expected_purchase: { type: "boolean" },
                source_reference: { type: "string" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              }, required: ["service_type_code", "description_public", "description_internal", "destination_segment", "start_date", "end_date", "requirement_level", "included", "creates_expected_purchase", "source_reference", "confidence"] } },
            },
            required: ["document_summary", "warnings", "services"],
          } } },
        }),
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const payload = await response.json().catch(() => ({})) as JsonRow;
    if (!response.ok) {
      const diagnostic = providerError(payload, response);
      throw new Error(diagnostic.code || `openai_http_${response.status}`);
    }
    const rawOutput = outputText(payload);
    if (!rawOutput) throw new Error("openai_empty_output");
    const normalized = normalizeServices(JSON.parse(rawOutput));
    if (!normalized.rows.length) throw new Error("openai_no_services_detected");
    await db.from("ai_import_runs").update({ status: "completed", response_id: text(payload.id, 200) || null, service_count: normalized.rows.length, warnings: normalized.warnings, completed_at: new Date().toISOString() }).eq("id", run.id);
    await db.from("timeline_events").insert({ organization_id: input.organizationId, case_id: caseId, event_type: "proposal.ai_import_analyzed", title: `${normalized.rows.length} servicios detectados en el itinerario`, payload: { proposal_id: input.proposalId, proposal_version_id: input.versionId, ai_import_run_id: run.id, model, service_count: normalized.rows.length }, created_by: input.actorId });
    return { runId: run.id, model, ...normalized };
  } catch (error) {
    const code = error instanceof Error && error.name === "AbortError" ? "openai_timeout" : error instanceof Error ? error.message : "ai_import_failed";
    await db.from("ai_import_runs").update({ status: "failed", error_code: text(code, 200), completed_at: new Date().toISOString() }).eq("id", run.id);
    throw new Error(code);
  }
  } finally {
    await db.storage.from(AI_ITINERARY_BUCKET).remove([input.storagePath]);
  }
}
