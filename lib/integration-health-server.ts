import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { listOrganizationSecretStatuses } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadThirdPartyIntegrationConfig } from "@/lib/third-party-integration-config-server";

export const integrationHealthIds = ["holded", "email", "whatsapp", "fillout", "booking", "openai"] as const;
export type IntegrationHealthId = (typeof integrationHealthIds)[number];
export type IntegrationHealthState = "healthy" | "attention" | "error" | "setup_required" | "inactive";

type IntegrationRunRow = {
  id: string;
  integration: string;
  kind: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  summary: string | null;
  last_error: string | null;
};

type OutboxRow = {
  id: string;
  channel: string | null;
  provider: string | null;
  event_type: string | null;
  status: string;
  attempts: number | null;
  max_attempts: number | null;
  last_error: string | null;
  created_at: string | null;
  last_attempt_at: string | null;
  processed_at: string | null;
};

type WebhookRow = {
  channel: string | null;
  status: string;
  last_error: string | null;
  received_at: string | null;
  processed_at: string | null;
};

export type IntegrationHealthRun = {
  id: string;
  kind: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  summary: string | null;
  error: string | null;
};

export type IntegrationHealthCard = {
  id: IntegrationHealthId;
  state: IntegrationHealthState;
  enabled: boolean;
  configured: boolean;
  label: string;
  detail: string;
  pending: number;
  failed: number;
  manualReview: number;
  processed: number;
  lastActivityAt: string | null;
  lastSuccessfulAt: string | null;
  lastTestAt: string | null;
  lastError: string | null;
  recentRuns: IntegrationHealthRun[];
};

export type IntegrationHealthWorkspace = {
  generatedAt: string;
  summary: {
    healthy: number;
    attention: number;
    errors: number;
    active: number;
  };
  cron: {
    state: "healthy" | "error" | "unknown";
    lastRunAt: string | null;
    finishedAt: string | null;
    summary: string | null;
    error: string | null;
  };
  integrations: IntegrationHealthCard[];
};

const labels: Record<IntegrationHealthId, string> = {
  holded: "Holded",
  email: "Hostinger Mail",
  whatsapp: "WhatsApp Business",
  fillout: "Fillout",
  booking: "Routsify Booking",
  openai: "OpenAI OCR",
};

function cleanText(value: unknown, limit = 500) {
  return String(value || "").trim().slice(0, limit) || null;
}

function latestDate(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null;
}

function belongsToIntegration(row: Pick<OutboxRow, "channel" | "provider" | "event_type">, integration: IntegrationHealthId) {
  const terms = [row.channel, row.provider, row.event_type].filter(Boolean).map((value) => String(value).toLowerCase());
  if (integration === "fillout") return terms.some((value) => value.includes("fillout") || value === "form" || value.includes("lead.created"));
  if (integration === "booking") return terms.some((value) => value.includes("booking"));
  if (integration === "email") return terms.some((value) => value.includes("email") || value.includes("smtp"));
  if (integration === "whatsapp") return terms.some((value) => value.includes("whatsapp"));
  if (integration === "openai") return terms.some((value) => value.includes("openai") || value.includes("ocr"));
  return terms.some((value) => value.includes("holded"));
}

function webhookBelongsToIntegration(row: WebhookRow, integration: IntegrationHealthId) {
  return belongsToIntegration({ channel: row.channel, provider: null, event_type: null }, integration);
}

function publicRun(row: IntegrationRunRow): IntegrationHealthRun {
  return {
    id: row.id,
    kind: row.kind || "worker",
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    summary: cleanText(row.summary),
    error: cleanText(row.last_error),
  };
}

export async function recordIntegrationRun(input: {
  organizationId: string;
  integration: string;
  kind: "connection_test" | "worker" | "cron";
  status: "processing" | "done" | "failed";
  startedAt: string;
  finishedAt?: string | null;
  triggerSource?: string | null;
  summary?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const finishedAt = input.finishedAt || (input.status === "processing" ? null : new Date().toISOString());
  const durationMs = finishedAt ? Math.max(0, Date.parse(finishedAt) - Date.parse(input.startedAt)) : null;
  const { data, error } = await getSupabaseAdminClient().from("integration_runs").insert({
    organization_id: input.organizationId,
    integration: input.integration,
    kind: input.kind,
    status: input.status,
    started_at: input.startedAt,
    finished_at: finishedAt,
    duration_ms: Number.isFinite(durationMs) ? durationMs : null,
    attempts: 1,
    trigger_source: cleanText(input.triggerSource, 80),
    summary: cleanText(input.summary),
    last_error: cleanText(input.lastError, 1000),
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function loadIntegrationHealth(organizationId: string): Promise<IntegrationHealthWorkspace> {
  const db = getSupabaseAdminClient();
  const [configuration, settings, secretStatuses, runsResult, outboxResult, webhookResult] = await Promise.all([
    loadThirdPartyIntegrationConfig(organizationId),
    loadEffectiveSettings(organizationId),
    listOrganizationSecretStatuses(organizationId),
    db.from("integration_runs")
      .select("id,integration,kind,status,started_at,finished_at,duration_ms,summary,last_error")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(250),
    db.from("integration_outbox")
      .select("id,channel,provider,event_type,status,attempts,max_attempts,last_error,created_at,last_attempt_at,processed_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(2000),
    db.from("webhook_events")
      .select("channel,status,last_error,received_at,processed_at")
      .eq("organization_id", organizationId)
      .order("received_at", { ascending: false })
      .limit(500),
  ]);

  if (runsResult.error) throw new Error(runsResult.error.message);
  if (outboxResult.error) throw new Error(outboxResult.error.message);
  if (webhookResult.error) throw new Error(webhookResult.error.message);

  const runs = (runsResult.data || []) as IntegrationRunRow[];
  const outbox = (outboxResult.data || []) as OutboxRow[];
  const webhooks = (webhookResult.data || []) as WebhookRow[];
  const secrets = new Map(secretStatuses.map((item) => [item.key, item.configured]));
  const enabled: Record<IntegrationHealthId, boolean> = {
    holded: Boolean(secrets.get("holded_api_key")),
    email: configuration.email.enabled,
    whatsapp: configuration.whatsapp.enabled,
    fillout: settings.boolean("integrations.fillout.enabled"),
    booking: configuration.booking.enabled,
    openai: Boolean(secrets.get("openai_api_key")),
  };
  const configured: Record<IntegrationHealthId, boolean> = {
    holded: Boolean(secrets.get("holded_api_key")),
    email: Boolean(configuration.email.smtpHost && configuration.email.fromAddress && secrets.get("smtp_password")),
    whatsapp: Boolean(configuration.whatsapp.phoneNumberId && secrets.get("whatsapp_access_token")),
    fillout: Boolean(
      settings.string("integrations.fillout.form_id")
      && settings.string("integrations.fillout.public_url")
      && secrets.get("fillout_webhook_secret")
    ),
    booking: Boolean(configuration.booking.baseUrl && configuration.booking.publicBookingUrl && secrets.get("booking_api_key")),
    openai: Boolean(secrets.get("openai_api_key")),
  };

  const integrations = integrationHealthIds.map((id): IntegrationHealthCard => {
    const integrationRuns = runs.filter((row) => row.integration === id);
    const integrationOutbox = outbox.filter((row) => belongsToIntegration(row, id));
    const integrationWebhooks = webhooks.filter((row) => webhookBelongsToIntegration(row, id));
    const latestTest = integrationRuns.find((row) => row.kind === "connection_test") || null;
    const pending = integrationOutbox.filter((row) => ["pending", "queued", "processing", "retry"].includes(row.status)).length;
    const failed = integrationOutbox.filter((row) => row.status === "failed").length;
    const manualReview = integrationOutbox.filter((row) => row.status === "manual_review").length;
    const processed = integrationOutbox.filter((row) => row.status === "done").length;
    const latestFailedOutbox = integrationOutbox.find((row) => ["failed", "manual_review"].includes(row.status) && row.last_error) || null;
    const latestFailedWebhook = integrationWebhooks.find((row) => row.status === "failed" && row.last_error) || null;
    const latestFailedRun = integrationRuns.find((row) => row.status === "failed" && row.last_error) || null;
    const lastActivityAt = latestDate([
      ...integrationRuns.map((row) => row.finished_at || row.started_at),
      ...integrationOutbox.map((row) => row.processed_at || row.last_attempt_at || row.created_at),
      ...integrationWebhooks.map((row) => row.processed_at || row.received_at),
    ]);
    const lastSuccessfulAt = latestDate([
      ...integrationRuns.filter((row) => row.status === "done").map((row) => row.finished_at || row.started_at),
      ...integrationOutbox.filter((row) => row.status === "done").map((row) => row.processed_at || row.last_attempt_at || row.created_at),
      ...integrationWebhooks.filter((row) => ["done", "processed"].includes(row.status)).map((row) => row.processed_at || row.received_at),
    ]);

    let state: IntegrationHealthState;
    let detail: string;
    if (!enabled[id]) {
      state = "inactive";
      detail = "Integración desactivada.";
    } else if (!configured[id]) {
      state = "setup_required";
      detail = "Faltan datos esenciales para poder conectarla.";
    } else if (failed > 0 || manualReview > 0 || latestTest?.status === "failed") {
      state = "error";
      detail = manualReview > 0 ? "Hay eventos que necesitan revisión manual." : "La última ejecución requiere atención.";
    } else if (pending > 0 || !lastSuccessfulAt) {
      state = "attention";
      detail = pending > 0 ? "Hay eventos esperando a ser procesados." : "Configurada, todavía sin una ejecución correcta registrada.";
    } else {
      state = "healthy";
      detail = "Conexión operativa sin incidencias pendientes.";
    }

    return {
      id,
      state,
      enabled: enabled[id],
      configured: configured[id],
      label: labels[id],
      detail,
      pending,
      failed,
      manualReview,
      processed,
      lastActivityAt,
      lastSuccessfulAt,
      lastTestAt: latestTest?.finished_at || latestTest?.started_at || null,
      lastError: cleanText(latestFailedOutbox?.last_error || latestFailedWebhook?.last_error || latestFailedRun?.last_error),
      recentRuns: integrationRuns.slice(0, 5).map(publicRun),
    };
  });

  const cronRun = runs.find((row) => row.integration === "operations_cron" && row.kind === "cron") || null;
  const healthy = integrations.filter((item) => item.state === "healthy").length;
  const errors = integrations.filter((item) => item.state === "error").length;
  const attention = integrations.filter((item) => ["attention", "setup_required"].includes(item.state)).length;
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      healthy,
      attention,
      errors,
      active: integrations.filter((item) => item.enabled).length,
    },
    cron: {
      state: !cronRun ? "unknown" : cronRun.status === "done" ? "healthy" : "error",
      lastRunAt: cronRun?.started_at || null,
      finishedAt: cronRun?.finished_at || null,
      summary: cleanText(cronRun?.summary),
      error: cleanText(cronRun?.last_error),
    },
    integrations,
  };
}

export async function retryFailedIntegrationEvents(input: {
  organizationId: string;
  integration: IntegrationHealthId;
  actorId: string;
}) {
  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("integration_outbox")
    .select("id,channel,provider,event_type,status,attempts,max_attempts")
    .eq("organization_id", input.organizationId)
    .in("status", ["failed", "manual_review"])
    .limit(500);
  if (error) throw new Error(error.message);

  const matching = ((data || []) as OutboxRow[]).filter((row) => belongsToIntegration(row, input.integration));
  const retryableIds = matching
    .filter((row) => row.status === "failed" && Number(row.attempts || 0) < Number(row.max_attempts || 3))
    .map((row) => row.id);
  const manualReview = matching.filter((row) => row.status === "manual_review" || Number(row.attempts || 0) >= Number(row.max_attempts || 3)).length;

  let scheduled = 0;
  if (retryableIds.length) {
    const { data: updatedRows, error: updateError } = await db.from("integration_outbox").update({
      status: "pending",
      sync_status: "pending",
      last_error: null,
      locked_at: null,
      locked_by: null,
      next_attempt_at: new Date().toISOString(),
      next_action: "Reintento solicitado desde Ajustes.",
    }).eq("organization_id", input.organizationId).eq("status", "failed").in("id", retryableIds).select("id");
    if (updateError) throw new Error(updateError.message);
    scheduled = updatedRows?.length || 0;

    if (scheduled) {
      const { error: auditError } = await db.from("audit_log").insert({
        organization_id: input.organizationId,
        actor_id: input.actorId,
        entity_type: "integration_outbox_batch",
        entity_id: null,
        action: "integration_retry_requested",
        before_data: { integration: input.integration, failed: scheduled },
        after_data: { integration: input.integration, scheduled, manual_review: manualReview },
      });
      if (auditError) throw new Error(auditError.message);
    }
  }

  return { scheduled, manualReview };
}
