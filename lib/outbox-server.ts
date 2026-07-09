import { createHash } from "crypto";
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
  const row = {
    organization_id: input.organizationId,
    channel: input.channel,
    event_type: input.eventType,
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

  if (!hasSupabaseAdminEnv()) {
    return { ok: true, mode: "demo" as const, idempotencyKey, row };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("integration_outbox").upsert(row, { onConflict: "organization_id,channel,event_type,idempotency_key" }).select("id,status,attempts,risk").single();
  if (error) return { ok: false, mode: "real" as const, error: error.message, idempotencyKey };
  return { ok: true, mode: "real" as const, idempotencyKey, data };
}

export async function markOutboxProcessed(id: string, status: "processing" | "done" | "failed" | "manual_review", errorMessage?: string) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: true, mode: "demo" as const, id, status };
  }
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("integration_outbox")
    .update({ status, last_error: errorMessage || null, last_attempt_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, mode: "real" as const, error: error.message };
  return { ok: true, mode: "real" as const };
}
