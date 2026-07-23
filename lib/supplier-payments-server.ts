import { PURCHASE_WITH_RELATIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  const raw = String(value || "").trim();
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function currencyValue(value: unknown, fallback = "EUR") {
  const currency = String(value || fallback || "EUR").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "EUR";
}

export async function registerManualSupplierPayment(input: {
  organizationId: string;
  purchaseId: string;
  actorId: string;
  amount?: unknown;
  paidAt?: unknown;
  method?: unknown;
  reference?: unknown;
  description?: unknown;
}) {
  const db = getSupabaseAdminClient();
  const { data: purchase, error: purchaseError } = await db
    .from("expected_purchases")
    .select("id,organization_id,case_id,supplier_id,supplier_name,service,expected_amount,amount,currency,payment_reference")
    .eq("id", input.purchaseId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (purchaseError) return { ok: false as const, error: purchaseError.message };
  if (!purchase) return { ok: false as const, error: "purchase_not_found" };

  const expectedAmount = numberValue(purchase.expected_amount || purchase.amount);
  const amount = numberValue(input.amount ?? expectedAmount);
  if (amount <= 0) return { ok: false as const, error: "invalid_payment_amount" };

  const currency = currencyValue(purchase.currency);
  const paidAt = dateValue(input.paidAt);
  const reference = String(input.reference || purchase.payment_reference || "").trim() || null;
  const method = String(input.method || "manual").trim().slice(0, 80) || "manual";
  const description = String(input.description || `${purchase.supplier_name || "Proveedor"} · ${purchase.service || "Pago proveedor"}`).trim().slice(0, 500);

  const { data: importResult, error: importError } = await (db as any).rpc("import_and_allocate_supplier_payment", {
    target_organization_id: input.organizationId,
    target_expected_purchase_id: input.purchaseId,
    payment_event: {
      amount,
      currency,
      paid_at: paidAt,
      description,
      payment_reference: reference,
      source: "manual",
      status: "matched",
      match_score: 100,
      source_payload: { method, actor_id: input.actorId, expected_purchase_id: input.purchaseId },
    },
    allocation_source: "manual",
    actor_id: input.actorId,
  });
  if (importError) return { ok: false as const, error: importError.message };
  if (!importResult?.ok) return { ok: false as const, error: String(importResult?.error || "supplier_payment_import_failed") };

  const { data, error } = await db
    .from("expected_purchases")
    .select(PURCHASE_WITH_RELATIONS_SELECT)
    .eq("id", input.purchaseId)
    .eq("organization_id", input.organizationId)
    .single();
  return error ? { ok: false as const, error: error.message } : { ok: true as const, data };
}
