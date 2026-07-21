import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type SupplierLike = Record<string, unknown> & { id?: unknown; name?: unknown };

function percentage(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) throw new Error("invalid_supplier_margin");
  return parsed;
}

export async function attachSupplierDefaultMargins<T extends SupplierLike>(organizationId: string, suppliers: T[]) {
  if (!suppliers.length) return suppliers.map((supplier) => ({ ...supplier, default_margin_pct: null as number | null }));
  const { data, error } = await getSupabaseAdminClient().from("margin_rules")
    .select("id,supplier_id,minimum_margin,priority,active")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .not("supplier_id", "is", null)
    .is("service_type_code", null)
    .is("destination", null)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const bySupplier = new Map<string, number>();
  for (const rule of data || []) {
    const supplierId = String(rule.supplier_id || "");
    if (supplierId && !bySupplier.has(supplierId)) bySupplier.set(supplierId, Number(rule.minimum_margin));
  }
  return suppliers.map((supplier) => ({ ...supplier, default_margin_pct: bySupplier.get(String(supplier.id || "")) ?? null }));
}

export async function saveSupplierDefaultMargin(input: { organizationId: string; supplierId: string; supplierName: string; value: unknown }) {
  const margin = percentage(input.value);
  const db = getSupabaseAdminClient();
  const { data: existing, error: readError } = await db.from("margin_rules")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("supplier_id", input.supplierId)
    .is("service_type_code", null)
    .is("destination", null)
    .order("priority", { ascending: true });
  if (readError) throw new Error(readError.message);

  const primaryId = existing?.[0]?.id ? String(existing[0].id) : null;
  const duplicateIds = (existing || []).slice(1).map((rule) => String(rule.id));
  if (duplicateIds.length) {
    const { error } = await db.from("margin_rules").update({ active: false, updated_at: new Date().toISOString() }).in("id", duplicateIds).eq("organization_id", input.organizationId);
    if (error) throw new Error(error.message);
  }

  if (margin === null) {
    if (primaryId) {
      const { error } = await db.from("margin_rules").update({ active: false, updated_at: new Date().toISOString() }).eq("id", primaryId).eq("organization_id", input.organizationId);
      if (error) throw new Error(error.message);
    }
    return null;
  }

  const payload = {
    name: `Margen predeterminado · ${input.supplierName}`.slice(0, 160),
    minimum_margin: margin,
    formula: "margin_on_sale",
    priority: 20,
    active: true,
    updated_at: new Date().toISOString(),
  };
  const query = primaryId
    ? db.from("margin_rules").update(payload).eq("id", primaryId).eq("organization_id", input.organizationId)
    : db.from("margin_rules").insert({ ...payload, organization_id: input.organizationId, supplier_id: input.supplierId });
  const { error } = await query;
  if (error) throw new Error(error.message);
  return margin;
}
