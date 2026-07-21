import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getRequestUserId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { attachSupplierDefaultMargins, saveSupplierDefaultMargin } from "@/lib/supplier-margin-server";

function text(value: unknown, max = 240) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, max) : null;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringList(value: unknown, maxItems = 30, maxLength = 80) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(source.map((item) => String(item ?? "").trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
}

const select = "id,name,category,email,phone,tax_id,country,billing_address,notes,active,holded_contact_id,preferred,risk_level,reliability_score,average_rating,payment_terms_days,default_currency,service_regions,cancellation_policy,emergency_contact,profile_updated_at,created_at,updated_at";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { supplierId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const marginValue = source.default_margin_pct;
  const margin = marginValue === null || marginValue === undefined || marginValue === "" ? null : Number(String(marginValue).replace(",", "."));
  if ("default_margin_pct" in source && margin !== null && (!Number.isFinite(margin) || margin < 0 || margin >= 100)) return NextResponse.json({ ok: false, error: "invalid_supplier_margin" }, { status: 400 });
  const db = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await db.from("suppliers").select(select).eq("id", supplierId).eq("organization_id", access.organizationId).maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if ("name" in source) {
    const name = text(source.name, 160);
    if (!name || name.length < 2) return NextResponse.json({ ok: false, error: "supplier_name_required" }, { status: 400 });
    patch.name = name;
  }
  if ("category" in source) patch.category = text(source.category, 100);
  if ("email" in source) patch.email = text(source.email, 240);
  if ("phone" in source) patch.phone = text(source.phone, 80);
  if ("tax_id" in source) patch.tax_id = text(source.tax_id, 80);
  if ("country" in source) patch.country = text(source.country, 100);
  if ("notes" in source) patch.notes = text(source.notes, 2000);
  if ("billing_address" in source) patch.billing_address = source.billing_address && typeof source.billing_address === "object" ? source.billing_address : {};
  if ("active" in source) patch.active = Boolean(source.active);
  if ("preferred" in source) patch.preferred = Boolean(source.preferred);
  if ("risk_level" in source) {
    const risk = String(source.risk_level || "low");
    if (!["low", "medium", "high"].includes(risk)) return NextResponse.json({ ok: false, error: "invalid_supplier_risk" }, { status: 400 });
    patch.risk_level = risk;
  }
  if ("reliability_score" in source) {
    const score = Math.round(numberValue(source.reliability_score, 70));
    if (score < 0 || score > 100) return NextResponse.json({ ok: false, error: "invalid_reliability_score" }, { status: 400 });
    patch.reliability_score = score;
  }
  if ("average_rating" in source) {
    const raw = source.average_rating;
    if (raw === null || raw === "") patch.average_rating = null;
    else {
      const rating = numberValue(raw, -1);
      if (rating < 0 || rating > 5) return NextResponse.json({ ok: false, error: "invalid_supplier_rating" }, { status: 400 });
      patch.average_rating = rating;
    }
  }
  if ("payment_terms_days" in source) {
    const days = Math.round(numberValue(source.payment_terms_days, 0));
    if (days < 0 || days > 365) return NextResponse.json({ ok: false, error: "invalid_payment_terms" }, { status: 400 });
    patch.payment_terms_days = days;
  }
  if ("default_currency" in source) {
    const currency = String(source.default_currency || "EUR").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ ok: false, error: "invalid_currency" }, { status: 400 });
    patch.default_currency = currency;
  }
  if ("service_regions" in source) patch.service_regions = stringList(source.service_regions);
  if ("cancellation_policy" in source) patch.cancellation_policy = text(source.cancellation_policy, 4000);
  if ("emergency_contact" in source) patch.emergency_contact = source.emergency_contact && typeof source.emergency_contact === "object" && !Array.isArray(source.emergency_contact) ? source.emergency_contact : {};
  if (["preferred", "risk_level", "reliability_score", "average_rating", "payment_terms_days", "default_currency", "service_regions", "cancellation_policy", "emergency_contact"].some((key) => key in source)) patch.profile_updated_at = now;

  const { data, error } = await db.from("suppliers").update(patch).eq("id", supplierId).eq("organization_id", access.organizationId).select(select).single();
  if (error?.code === "23505") return NextResponse.json({ ok: false, error: "supplier_already_exists" }, { status: 409 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  try {
    if ("default_margin_pct" in source) await saveSupplierDefaultMargin({ organizationId: access.organizationId, supplierId, supplierName: String(data.name), value: margin });
  } catch (caught) {
    return NextResponse.json({ ok: false, error: caught instanceof Error ? caught.message : "supplier_margin_save_failed" }, { status: 400 });
  }
  const [enriched] = await attachSupplierDefaultMargins(access.organizationId, [data]);

  const actorId = await getRequestUserId(request);
  await db.from("audit_log").insert({ organization_id: access.organizationId, actor_id: actorId, entity_type: "supplier", entity_id: supplierId, action: "supplier.updated", before_data: existing, after_data: enriched });
  return NextResponse.json({ ok: true, data: enriched });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { supplierId } = await params;
  const organizationId = access.organizationId;
  const db = getSupabaseAdminClient();
  const { data: supplier, error: supplierError } = await db.from("suppliers")
    .select("id,name,holded_contact_id,created_at")
    .eq("id", supplierId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (supplierError) return NextResponse.json({ ok: false, error: supplierError.message }, { status: 400 });
  if (!supplier) return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404 });
  if (supplier.holded_contact_id) return NextResponse.json({ ok: false, error: "supplier_has_protected_history", blockers: { holded: 1 } }, { status: 409 });

  const [purchases, budgetLines, invoices, communications, services, incidents, outbox] = await Promise.all([
    db.from("expected_purchases").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("supplier_id", supplierId),
    db.from("budget_lines").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("supplier_id", supplierId),
    db.from("supplier_invoices").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("supplier_id", supplierId),
    db.from("communication_followups").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("supplier_id", supplierId),
    db.from("supplier_services").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("supplier_id", supplierId),
    db.from("supplier_incidents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("supplier_id", supplierId),
    db.from("integration_outbox").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("entity_id", supplierId),
  ]);
  const dependencyError = [purchases, budgetLines, invoices, communications, services, incidents, outbox].find((result) => result.error)?.error;
  if (dependencyError) return NextResponse.json({ ok: false, error: dependencyError.message }, { status: 400 });
  const blockers = {
    purchases: purchases.count || 0,
    budget_lines: budgetLines.count || 0,
    invoices: invoices.count || 0,
    communications: communications.count || 0,
    services: services.count || 0,
    incidents: incidents.count || 0,
    outbox: outbox.count || 0,
  };
  if (Object.values(blockers).some((value) => value > 0)) {
    return NextResponse.json({ ok: false, error: "supplier_has_protected_history", blockers }, { status: 409 });
  }

  const { error: deleteError } = await db.from("suppliers").delete().eq("id", supplierId).eq("organization_id", organizationId);
  if (deleteError) return NextResponse.json({ ok: false, error: deleteError.code === "23503" ? "supplier_has_protected_history" : deleteError.message }, { status: deleteError.code === "23503" ? 409 : 400 });
  await db.from("audit_log").insert({ organization_id: organizationId, actor_id: access.actorId, entity_type: "supplier", entity_id: supplierId, action: "supplier.deleted", before_data: supplier });
  return NextResponse.json({ ok: true, data: { id: supplierId } });
}
