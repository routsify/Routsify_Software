import { createHash } from "crypto";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { canonicalJsonStringify } from "@/lib/webhook-security";

export type OutboxServerInput = {
  organizationId: string;
  channel: "form" | "booking" | "payment" | "fiscal" | "supplier" | "holded";
  eventType: string;
  relatedCaseId?: string | null;
  payload: Record<string, unknown>;
  risk?: "low" | "medium" | "high";
  businessRule?: string;
  nextAction?: string;
  idempotencyKey?: string;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(canonicalJsonStringify(value)).digest("hex");
}

export function buildIdempotencyKey(input: Pick<OutboxServerInput, "channel" | "eventType" | "payload" | "idempotencyKey">) {
  return input.idempotencyKey || stableHash({ channel: input.channel, eventType: input.eventType, payload: input.payload });
}

export async function enqueueOutboxEvent(input: OutboxServerInput) {
  const idempotencyKey = buildIdempotencyKey(input);
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "supabase" as const, error: "supabase_admin_not_configured", idempotencyKey };

  if (input.channel === "holded") {
    const holdedKey = await getOrganizationSecret(input.organizationId, "holded_api_key");
    if (!holdedKey) {
      return {
        ok: true,
        mode: "supabase" as const,
        idempotencyKey,
        skipped: true,
        reason: "holded_pending_configuration",
        data: { id: null, status: "pending_configuration", attempts: 0, risk: input.risk || "low" },
      };
    }
  }

  const row = {
    organization_id: input.organizationId,
    provider: input.channel,
    channel: input.channel,
    event_type: input.eventType,
    entity_type: "integration_event",
    related_case_id: input.relatedCaseId || null,
    status: input.risk === "high" ? "manual_review" : "pending",
    attempts: 0,
    max_attempts: input.risk === "high" ? 2 : 3,
    risk: input.risk || "low",
    idempotency_key: idempotencyKey,
    payload: input.payload,
    business_rule: input.businessRule || null,
    next_action: input.nextAction || null,
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("integration_outbox").insert(row).select("id,status,attempts,risk").single();
  if (!error) return { ok: true, mode: "supabase" as const, idempotencyKey, skipped: false, duplicate: false, data };

  if (error.code !== "23505") return { ok: false, mode: "supabase" as const, error: error.message, idempotencyKey };

  const { data: existing, error: existingError } = await supabase
    .from("integration_outbox")
    .select("id,status,attempts,risk")
    .eq("organization_id", input.organizationId)
    .eq("channel", input.channel)
    .eq("event_type", input.eventType)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingError || !existing) return { ok: false, mode: "supabase" as const, error: existingError?.message || "duplicate_outbox_event_not_found", idempotencyKey };

  return {
    ok: true,
    mode: "supabase" as const,
    idempotencyKey,
    skipped: true,
    duplicate: true,
    reason: "duplicate_event_preserved",
    data: existing,
  };
}

export async function markOutboxProcessed(id: string, status: "processing" | "done" | "failed" | "manual_review", errorMessage?: string) {
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "supabase" as const, error: "supabase_admin_not_configured" };

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("integration_outbox")
    .update({ status, last_error: errorMessage || null, last_attempt_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, mode: "supabase" as const, error: error.message };
  return { ok: true, mode: "supabase" as const };
}
