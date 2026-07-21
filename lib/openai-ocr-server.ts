import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const fieldNames = ["document_type", "first_name", "last_name", "full_name", "birth_date", "nationality", "document_number", "document_country", "document_expires_at", "mrz"] as const;
export type OcrFieldName = (typeof fieldNames)[number];

type OcrField = { name: OcrFieldName; value: string | null; confidence: number };
type OcrPayload = { document_type: string | null; overall_confidence: number; fields: OcrField[] };

function providerDiagnostic(payload: Record<string, unknown>, response: Response, model: string) {
  const error = payload.error && typeof payload.error === "object"
    ? payload.error as Record<string, unknown>
    : {};
  const safe = (value: unknown) => String(value ?? "").trim().slice(0, 120) || null;
  return {
    provider: "openai",
    model,
    http_status: response.status,
    request_id: safe(response.headers.get("x-request-id")),
    error_type: safe(error.type),
    error_code: safe(error.code),
    error_param: safe(error.param),
  };
}

function cleanConfidence(value: unknown) {
  const number = Number(value || 0);
  return Math.max(0, Math.min(Number.isFinite(number) ? number : 0, 1));
}

async function getOcrModel(organizationId: string) {
  const { data } = await getSupabaseAdminClient().from("routsify_settings").select("value").eq("organization_id", organizationId).eq("key", "integrations.ocr.model").maybeSingle();
  const value = data?.value;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "value" in value && String((value as { value?: unknown }).value || "").trim()) return String((value as { value?: unknown }).value).trim();
  return process.env.OPENAI_OCR_MODEL || "gpt-4.1-mini";
}

export async function testOpenAIConnection(organizationId: string) {
  const apiKey = await getOrganizationSecret(organizationId, "openai_api_key");
  if (!apiKey) return { ok: false as const, status: 503, error: "openai_api_key_not_configured" };
  const model = await getOcrModel(organizationId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!response.ok) return { ok: false as const, status: response.status, error: `openai_http_${response.status}` };
    return { ok: true as const, status: response.status, model };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false as const, status: 504, error: error instanceof Error && error.name === "AbortError" ? "openai_timeout" : "openai_network_error" };
  }
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") return String((part as Record<string, unknown>).text);
    }
  }
  return "";
}

function normalizePayload(raw: unknown): OcrPayload {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const inputFields = Array.isArray(source.fields) ? source.fields : [];
  const map = new Map<string, OcrField>();
  for (const item of inputFields) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name || "") as OcrFieldName;
    if (!fieldNames.includes(name)) continue;
    map.set(name, { name, value: row.value === null || row.value === undefined ? null : String(row.value).trim() || null, confidence: cleanConfidence(row.confidence) });
  }
  const fields = fieldNames.map((name) => map.get(name) || { name, value: null, confidence: 0 });
  return { document_type: source.document_type ? String(source.document_type) : fields.find((field) => field.name === "document_type")?.value || null, overall_confidence: cleanConfidence(source.overall_confidence), fields };
}

export async function runDocumentOcr(input: { organizationId: string; documentId: string; travelerId?: string | null; actorId: string }) {
  const supabase = getSupabaseAdminClient();
  const { data: document, error } = await supabase.from("documents").select("id,organization_id,case_id,storage_bucket,bucket,storage_path,file_name,mime_type").eq("id", input.documentId).eq("organization_id", input.organizationId).maybeSingle();
  if (error || !document) throw new Error(error?.message || "document_not_found");
  const bucket = String(document.storage_bucket || document.bucket || "case-documents");
  const { data: file, error: downloadError } = await supabase.storage.from(bucket).download(String(document.storage_path));
  if (downloadError || !file) throw new Error(downloadError?.message || "document_download_failed");
  if (file.size > 10 * 1024 * 1024) throw new Error("document_too_large_for_ocr");
  const apiKey = await getOrganizationSecret(input.organizationId, "openai_api_key");
  if (!apiKey) throw new Error("openai_api_key_not_configured");
  const model = await getOcrModel(input.organizationId);
  const { data: run, error: runError } = await supabase.from("ocr_runs").insert({ organization_id: input.organizationId, case_id: document.case_id, document_id: document.id, traveler_id: input.travelerId || null, provider: "openai", status: "processing", started_at: new Date().toISOString(), created_by: input.actorId }).select("id").single();
  if (runError) throw new Error(runError.message);
  await supabase.from("documents").update({ ocr_status: "processing", updated_at: new Date().toISOString() }).eq("id", document.id);

  let diagnostic: Record<string, unknown> = { provider: "openai", model };
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = String(document.mime_type || file.type || "application/octet-stream");
    const filePart = mimeType === "application/pdf"
      ? { type: "input_file", filename: String(document.file_name || "document.pdf"), file_data: `data:${mimeType};base64,${base64}`, detail: "high" }
      : { type: "input_image", image_url: `data:${mimeType};base64,${base64}`, detail: "high" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          store: false,
          input: [{ role: "user", content: [
            { type: "input_text", text: "Extrae únicamente los datos visibles del DNI o pasaporte. No inventes valores. Usa fechas ISO YYYY-MM-DD. Para cada campo devuelve una confianza entre 0 y 1. Si no es legible, usa null y confianza 0." },
            filePart,
          ] }],
          text: { format: { type: "json_schema", name: "travel_document_ocr", strict: true, schema: {
            type: "object", additionalProperties: false,
            properties: {
              document_type: { type: ["string", "null"] },
              overall_confidence: { type: "number", minimum: 0, maximum: 1 },
              fields: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string", enum: [...fieldNames] }, value: { type: ["string", "null"] }, confidence: { type: "number", minimum: 0, maximum: 1 } }, required: ["name", "value", "confidence"] } },
            }, required: ["document_type", "overall_confidence", "fields"],
          } } },
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
    const responsePayload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      diagnostic = providerDiagnostic(responsePayload, response, model);
      throw new Error(`openai_http_${response.status}`);
    }
    const text = outputText(responsePayload);
    if (!text) throw new Error("openai_empty_output");
    const parsed = normalizePayload(JSON.parse(text));
    const rows = parsed.fields.map((field) => ({ organization_id: input.organizationId, ocr_run_id: run.id, field_name: field.name, extracted_value: field.value, confidence: field.confidence, review_status: field.confidence >= 0.95 ? "suggested" : "pending" }));
    const { error: fieldError } = await supabase.from("ocr_fields").insert(rows);
    if (fieldError) throw new Error(fieldError.message);
    const status = parsed.overall_confidence >= 0.95 && parsed.fields.filter((field) => field.value).every((field) => field.confidence >= 0.9) ? "review_required" : "review_required";
    await supabase.from("ocr_runs").update({ status, confidence_overall: parsed.overall_confidence, raw_payload_redacted: { response_id: responsePayload.id || null, model, document_type: parsed.document_type }, completed_at: new Date().toISOString() }).eq("id", run.id);
    await supabase.from("documents").update({ ocr_status: status, updated_at: new Date().toISOString() }).eq("id", document.id);
    await supabase.from("timeline_events").insert({ organization_id: input.organizationId, case_id: document.case_id, event_type: "document.ocr_completed", title: "OCR completado; revisión humana pendiente", payload: { document_id: document.id, ocr_run_id: run.id, confidence: parsed.overall_confidence }, created_by: input.actorId });
    return { runId: run.id, status, confidence: parsed.overall_confidence, fields: parsed.fields };
  } catch (caught) {
    const message = caught instanceof Error && caught.name === "AbortError"
      ? "openai_timeout"
      : caught instanceof Error ? caught.message : "ocr_failed";
    await supabase.from("ocr_runs").update({ status: "failed", error: message, raw_payload_redacted: diagnostic, completed_at: new Date().toISOString() }).eq("id", run.id);
    await supabase.from("documents").update({ ocr_status: "failed", updated_at: new Date().toISOString() }).eq("id", document.id);
    await supabase.from("timeline_events").insert({ organization_id: input.organizationId, case_id: document.case_id, event_type: "document.ocr_failed", title: "OCR no completado", payload: { document_id: document.id, ocr_run_id: run.id, error: message, provider_code: diagnostic.error_code || null }, created_by: input.actorId });
    throw new Error(message);
  }
}

export async function reviewOcrRun(input: { organizationId: string; runId: string; actorId: string; fields: Record<string, string | null>; approve: boolean }) {
  const supabase = getSupabaseAdminClient();
  const { data: run, error } = await supabase.from("ocr_runs").select("id,document_id,traveler_id,case_id,status").eq("id", input.runId).eq("organization_id", input.organizationId).maybeSingle();
  if (error || !run) throw new Error(error?.message || "ocr_run_not_found");
  const { data: existing, error: fieldsError } = await supabase.from("ocr_fields").select("id,field_name,extracted_value").eq("ocr_run_id", run.id).eq("organization_id", input.organizationId);
  if (fieldsError) throw new Error(fieldsError.message);
  for (const field of existing || []) {
    const corrected = Object.prototype.hasOwnProperty.call(input.fields, field.field_name) ? input.fields[field.field_name] : field.extracted_value;
    const { error: updateError } = await supabase.from("ocr_fields").update({ corrected_value: corrected, review_status: input.approve ? "approved" : "reviewed", reviewed_by: input.actorId, reviewed_at: new Date().toISOString() }).eq("id", field.id);
    if (updateError) throw new Error(updateError.message);
  }
  if (input.approve && run.traveler_id) {
    const value = (name: string) => Object.prototype.hasOwnProperty.call(input.fields, name) ? input.fields[name] : (existing || []).find((field) => field.field_name === name)?.extracted_value;
    const patch: Record<string, unknown> = { ocr_status: "approved", review_status: "approved", reviewed_by: input.actorId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const mapping: Record<string, string> = { first_name: "first_name", last_name: "last_name", birth_date: "birth_date", nationality: "nationality", document_number: "document_number", document_country: "document_country", document_expires_at: "document_expires_at", document_type: "document_type", mrz: "mrz" };
    for (const [source, target] of Object.entries(mapping)) { const item = value(source); if (item) patch[target] = item; }
    await supabase.from("travelers").update(patch).eq("id", run.traveler_id).eq("organization_id", input.organizationId);
  }
  const status = input.approve ? "approved" : "reviewed";
  await supabase.from("ocr_runs").update({ status, reviewed_at: new Date().toISOString(), reviewed_by: input.actorId }).eq("id", run.id);
  await supabase.from("documents").update({ ocr_status: status, updated_at: new Date().toISOString() }).eq("id", run.document_id);
  await supabase.from("timeline_events").insert({ organization_id: input.organizationId, case_id: run.case_id, event_type: `document.ocr_${status}`, title: input.approve ? "Datos OCR aprobados" : "Datos OCR revisados", payload: { document_id: run.document_id, ocr_run_id: run.id }, created_by: input.actorId });
  return { runId: run.id, status };
}
