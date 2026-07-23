import { PURCHASE_WITH_RELATIONS_SELECT } from "@/lib/query-selects";
import { syncHoldedPurchaseCandidates } from "@/lib/holded-outbox-handlers-v2";
import { recordIntegrationRun } from "@/lib/integration-health-server";
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
  approvedCost?: number | null;
}) {
  if (![...ACTIVE_STATUSES, ...FINAL_STATUSES].includes(input.status)) return { ok: false as const, error: "invalid_status" };
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await getExpectedPurchase(input.organizationId, input.purchaseId);
  if (existingError) return { ok: false as const, error: existingError.message };
  if (!existing) return { ok: false as const, error: "purchase_not_found" };

  const reason = input.reason?.trim() || "";
  if (input.status === "not_required" && reason.length < 5) return { ok: false as const, error: "not_required_reason_required" };
  if (FINAL_STATUSES.has(String(existing.status)) && existing.status !== input.status) return { ok: false as const, error: "final_purchase_status_locked" };

  if (input.status === "approved") {
    const invoices = Array.isArray(existing.supplier_invoices) ? existing.supplier_invoices : [];
    const holdedPurchaseId = input.holdedPurchaseId || existing.holded_purchase_id || null;
    if (!invoices.length && !holdedPurchaseId) return { ok: false as const, error: "invoice_or_holded_purchase_required" };
    const latestInvoice = [...invoices].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
    const approvedCost = input.approvedCost ?? Number(existing.invoice_total ?? latestInvoice?.total_amount ?? latestInvoice?.total ?? existing.expected_amount ?? existing.amount ?? 0);
    if (!Number.isFinite(Number(approvedCost)) || Number(approvedCost) < 0) return { ok: false as const, error: "invalid_approved_cost" };
    const { error: approveError } = await supabase.rpc("approve_expected_purchase", {
      target_org: input.organizationId,
      target_purchase: input.purchaseId,
      target_holded_purchase_id: holdedPurchaseId || "",
      approved_amount: Number(approvedCost),
      actor: input.actorId,
      review_note: input.reviewNotes?.trim() || null,
    });
    if (approveError) return { ok: false as const, error: approveError.message };
    const { data, error } = await getExpectedPurchase(input.organizationId, input.purchaseId);
    return error ? { ok: false as const, error: error.message } : { ok: true as const, data };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.reviewNotes !== undefined) patch.review_notes = input.reviewNotes || null;
  if (input.holdedPurchaseId) patch.holded_purchase_id = input.holdedPurchaseId;
  if (input.status === "not_required") {
    patch.not_required_reason = reason;
    patch.not_required_at = now;
    patch.not_required_by = input.actorId;
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
  const { data: purchase, error } = await getExpectedPurchase(input.organizationId, input.purchaseId);
  if (error) return { ok: false as const, error: error.message };
  if (!purchase) return { ok: false as const, error: "purchase_not_found" };
  try {
    const data = await syncHoldedPurchaseCandidates(input.organizationId, { targetPurchaseId: input.purchaseId });
    return { ok: true as const, data: { ...data, mode: "holded_import_only" } };
  } catch (caught) {
    return { ok: false as const, error: caught instanceof Error ? caught.message : "holded_sync_failed" };
  }
}

export async function syncExpectedPurchasesFromHolded(input: { organizationId: string }) {
  const startedAt = new Date().toISOString();
  try {
    const data = await syncHoldedPurchaseCandidates(input.organizationId);
    const finishedAt = new Date().toISOString();
    await recordIntegrationRun({
      organizationId: input.organizationId,
      integration: "holded_supplier_invoices",
      kind: "worker",
      status: "done",
      startedAt,
      finishedAt,
      triggerSource: "manual",
      summary: `${Number(data.importedInvoices || 0)} facturas importadas, ${Number(data.autoApproved || 0)} conciliadas manualmente.`,
      metadata: { ...data, mode: "manual_sync" },
    }).catch(() => null);
    return { ok: true as const, data };
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "holded_sync_failed";
    await recordIntegrationRun({
      organizationId: input.organizationId,
      integration: "holded_supplier_invoices",
      kind: "worker",
      status: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      triggerSource: "manual",
      summary: "Error sincronizando facturas de proveedor desde Holded.",
      lastError: error,
      metadata: { mode: "manual_sync" },
    }).catch(() => null);
    return { ok: false as const, error };
  }
}
