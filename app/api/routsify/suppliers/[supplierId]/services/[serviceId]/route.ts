import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getRequestUserId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function text(value: unknown, max = 300) { return String(value ?? "").trim().slice(0, max); }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function optionalDate(value: unknown) { const raw = text(value, 10); return raw ? (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined) : null; }

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ supplierId: string; serviceId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const { supplierId, serviceId } = await params;
  const source = body as Record<string, unknown>;
  const db = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await db.from("supplier_services").select("*").eq("id", serviceId).eq("supplier_id", supplierId).eq("organization_id", access.organizationId).maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ ok: false, error: "supplier_service_not_found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in source) { const name = text(source.name, 160); if (name.length < 2) return NextResponse.json({ ok: false, error: "service_name_required" }, { status: 400 }); patch.name = name; }
  if ("category" in source) patch.category = text(source.category, 100) || null;
  if ("destination" in source) patch.destination = text(source.destination, 120) || null;
  if ("currency" in source) { const currency = text(source.currency || "EUR", 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ ok: false, error: "invalid_currency" }, { status: 400 }); patch.currency = currency; }
  if ("unit" in source) patch.unit = text(source.unit, 80) || null;
  if ("base_cost" in source) { const value = optionalNumber(source.base_cost); if (value === undefined || (value !== null && value < 0)) return NextResponse.json({ ok: false, error: "invalid_base_cost" }, { status: 400 }); patch.base_cost = value; }
  if ("tax_rate" in source) { const value = optionalNumber(source.tax_rate); if (value === undefined || (value !== null && (value < 0 || value > 100))) return NextResponse.json({ ok: false, error: "invalid_tax_rate" }, { status: 400 }); patch.tax_rate = value; }
  if ("valid_from" in source) { const value = optionalDate(source.valid_from); if (value === undefined) return NextResponse.json({ ok: false, error: "invalid_validity_dates" }, { status: 400 }); patch.valid_from = value; }
  if ("valid_until" in source) { const value = optionalDate(source.valid_until); if (value === undefined) return NextResponse.json({ ok: false, error: "invalid_validity_dates" }, { status: 400 }); patch.valid_until = value; }
  if ("active" in source) patch.active = Boolean(source.active);
  if ("notes" in source) patch.notes = text(source.notes, 2000) || null;

  const validFrom = String(patch.valid_from ?? existing.valid_from ?? "");
  const validUntil = String(patch.valid_until ?? existing.valid_until ?? "");
  if (validFrom && validUntil && validFrom > validUntil) return NextResponse.json({ ok: false, error: "invalid_validity_dates" }, { status: 400 });

  const { data, error } = await db.from("supplier_services").update(patch).eq("id", serviceId).eq("supplier_id", supplierId).eq("organization_id", access.organizationId).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const actorId = await getRequestUserId(request);
  await db.from("audit_log").insert({ organization_id: access.organizationId, actor_id: actorId, entity_type: "supplier_service", entity_id: serviceId, action: "supplier_service.updated", before_data: existing, after_data: data });
  return NextResponse.json({ ok: true, data });
}
