import { NextRequest, NextResponse } from "next/server";
import { getWebhookIntegrationConfig } from "@/lib/integration-config-server";
import { enqueueOutboxEvent } from "@/lib/outbox-server";
import { processOutboxBatch } from "@/lib/outbox-worker-server";
import { providerIdempotencyKey, verifyStaticBearerRequest, verifyWebhookRequest } from "@/lib/webhook-security";

export const maxDuration = 60;

async function resolveWebhookOrganizationId() {
  return process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
}

function normalizedKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function scalarValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(scalarValue).filter((item) => item !== null).join(", ");
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (row.fullName || row.email) return row.fullName || row.email;
    if (row.start || row.end) return [row.start, row.end].filter(Boolean).join(" / ");
    if (row.formattedAddress) return row.formattedAddress;
    if (row.name) return row.name;
    return JSON.stringify(value);
  }
  return String(value);
}

function assignAlias(output: Record<string, unknown>, key: string, value: unknown) {
  const aliases: Record<string, string> = {
    nombre: "name",
    nombre_completo: "name",
    nombre_y_apellidos: "name",
    name: "name",
    full_name: "name",
    correo: "email",
    correo_electronico: "email",
    email: "email",
    email_address: "email",
    telefono: "phone",
    numero_de_telefono: "phone",
    movil: "phone",
    whatsapp: "phone",
    phone: "phone",
    destino: "destination",
    destinos: "destination",
    destino_s: "destination",
    destination: "destination",
    numero_de_personas: "travelers",
    numero_de_viajeros: "travelers",
    personas: "travelers",
    viajeros: "travelers",
    travelers: "travelers",
    travellers: "travelers",
    presupuesto: "budget",
    presupuesto_orientativo: "budget",
    budget: "budget",
    fecha_de_salida: "travel_start",
    fecha_inicio: "travel_start",
    fecha_de_inicio: "travel_start",
    travel_start: "travel_start",
    start_date: "travel_start",
    fecha_de_regreso: "travel_end",
    fecha_fin: "travel_end",
    fecha_de_fin: "travel_end",
    travel_end: "travel_end",
    end_date: "travel_end",
    campana: "campaign",
    campaign: "campaign",
    utm_campaign: "campaign",
  };
  output[key] = value;
  const alias = aliases[key];
  if (alias && (output[alias] === undefined || output[alias] === null || output[alias] === "")) output[alias] = value;
}

function normalizeFilloutSubmission(payload: Record<string, unknown>) {
  const submission = payload.submission && typeof payload.submission === "object" && !Array.isArray(payload.submission)
    ? payload.submission as Record<string, unknown>
    : payload;
  const output: Record<string, unknown> = {
    ...submission,
    source: "fillout",
    submission_id: submission.submissionId || submission.submission_id || payload.submissionId || payload.submission_id,
    submitted_at: submission.submissionTime || submission.submission_time,
    fillout_submission: submission,
  };

  const groups = [submission.questions, submission.calculations, submission.urlParameters];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const key = normalizedKey(row.name || row.id);
      if (!key) continue;
      assignAlias(output, key, scalarValue(row.value));
    }
  }

  if (Array.isArray(submission.scheduling)) {
    for (const item of submission.scheduling) {
      if (!item || typeof item !== "object") continue;
      const value = (item as Record<string, unknown>).value;
      if (!value || typeof value !== "object") continue;
      const schedule = value as Record<string, unknown>;
      if (!output.name && schedule.fullName) output.name = schedule.fullName;
      if (!output.email && schedule.email) output.email = schedule.email;
      output.scheduling_event_id = schedule.eventId || null;
      output.scheduling_start = schedule.eventStartTime || null;
      output.scheduling_end = schedule.eventEndTime || null;
    }
  }

  if (!output.email && submission.login && typeof submission.login === "object") {
    output.email = (submission.login as Record<string, unknown>).email || null;
  }
  return output;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const organizationId = await resolveWebhookOrganizationId();
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 503 });
  const configuration = await getWebhookIntegrationConfig(organizationId, "fillout");
  if (!configuration.enabled) return NextResponse.json({ ok: false, error: "fillout_integration_disabled" }, { status: 503 });

  const eventId = request.headers.get("x-routsify-event-id") || request.headers.get("x-idempotency-key") || request.headers.get("x-fillout-submission-id");
  const hasHmacHeaders = Boolean(request.headers.get("x-routsify-signature") || request.headers.get("x-routsify-timestamp"));
  const verification = hasHmacHeaders
    ? verifyWebhookRequest({ rawBody, secret: configuration.secret || undefined, signature: request.headers.get("x-routsify-signature"), timestamp: request.headers.get("x-routsify-timestamp"), eventId })
    : verifyStaticBearerRequest({ secret: configuration.secret || undefined, authorization: request.headers.get("authorization"), eventId });
  if (!verification.ok) return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });

  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody || "null");
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? normalizeFilloutSubmission(parsed as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const result = await enqueueOutboxEvent({ organizationId, channel: "form", eventType: "lead.created", payload: { ...payload, verificationMode: verification.mode }, risk: "low", businessRule: "Formulario externo entra primero como solicitud, nunca como expediente directo.", nextAction: "Cualificar solicitud y deduplicar cliente.", idempotencyKey: providerIdempotencyKey({ channel: "form", eventType: "lead.created", payload, fallbackRawBody: rawBody, eventId: verification.eventId }) });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  const processing = await processOutboxBatch(25);
  return NextResponse.json({ ...result, processing }, { status: 200 });
}
