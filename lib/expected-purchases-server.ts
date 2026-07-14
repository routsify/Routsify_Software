import { PURCHASE_WITH_RELATIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const ACTIVE_STATUSES = new Set(["expected", "requested", "uploaded", "holded_candidate", "matched", "review_needed"]);
const FINAL_STATUSES = new Set(["approved", "not_required", "cancelled"]);

export async function getExpectedPurchase(organizationId: string, purchaseId: string) {
  return getSupabaseAdminClient()
    .from("expected_purchases")
    .select(PURCHASE_WITH_RELATIONS_SELECT)
    .eq("id", purchaseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
}

export async function transitionExpectedPurchase(input: {
  organizationId: string;
  purchaseId: string;
  status: string;
  actorId: string;
  reason?: string | null;
  reviewNotes?: string | null;
  holdedPurchaseId?: string | null;
}) {
  if (![...ACTIVE_STATUSES, ...FINAL_STATUSES].includes(input.status)) return { ok: false as const, error: "invalid_status" };
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await getExpectedPurchase(input.organizationId, input.purchaseId);
  if (existingError) return { ok: false as const, error: existingError.message };
  if (!existing) return { ok: false as const, error: "purchase_not_found" };

  const reason = input.reason?.trim() || "";
  if (input.status === "not_required" && reason.length < 5) return { ok: false as const, error: "not_required_reason_required" };
  if (input.status === "approved") {
    const invoices = Array.isArray(existing.supplier_invoices) ? existing.supplier_invoices : [];
    if (!invoices.length && !existing.holded_purchase_id && !input.holdedPurchaseId) return { ok: false as const, error: "invoice_or_holded_purchase_required" };
  }
  if (FINAL_STATUSES.has(String(existing.status)) && existing.status !== input.status) return { ok: false as const, error: "final_purchase_status_locked" };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.reviewNotes !== undefined) patch.review_notes = input.reviewNotes || null;
  if (input.holdedPurchaseId) patch.holded_purchase_id = input.holdedPurchaseId;
  if (input.status === "not_required") {
    patch.not_required_reason = reason;
    patch.not_required_at = now;
    patch.not_required_by = input.actorId;
  }
  if (input.status === "approved") {
    patch.approved_at = now;
    patch.approved_by = input.actorId;
    patch.sync_status = existing.holded_purchase_id || input.holdedPurchaseId ? "synced" : "manual_review";
  }

  const { data, error } = await supabase
    .from("expected_purchases")
    .update(patch)
    .eq("id", input.purchaseId)
    .eq("organization_id", input.organizationId)
    .select(PURCHASE_WITH_RELATIONS_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("timeline_events").insert({
    organization_id: input.organizationId,
    case_id: existing.case_id,
    event_type: `supplier_purchase.${input.status}`,
    title: `Compra proveedor: ${input.status}`,
    payload: { expected_purchase_id: input.purchaseId, previous_status: existing.status, reason: reason || null },
    created_by: input.actorId,
  });
  return { ok: true as const, data };
}

export async function enqueuePurchaseHoldedSync(input: { organizationId: string; purchaseId: string; actorId: string }) {
  const supabase = getSupabaseAdminClient();
  const { data: purchase, error } = await getExpectedPurchase(input.organizationId, input.purchaseId);
  if (error) return { ok: false as const, error: error.message };
  if (!purchase) return { ok: false as const, error: "purchase_not_found" };
  const idempotencyKey = `holded-purchase:${purchase.id}:${purchase.updated_at || purchase.created_at}`;
  const { data, error: outboxError } = await supabase.rpc("enqueue_integration_event", {
    target_org: input.organizationId,
    channel_name: "holded",
    event_name: "purchase.sync",
    idem_key: idempotencyKey,
    event_payload: { expected_purchase_id: purchase.id, case_id: purchase.case_id, actor_id: input.actorId },
    event_risk: "medium",
    rule: "Sincronizar compra de proveedor de forma idempotente.",
    action: "Revisar el resultado en Compras / Proveedores.",
  });
  return outboxError ? { ok: false as const, error: outboxError.message } : { ok: true as const, data: { outbox_id: data, idempotency_key: idempotencyKey } };
}
