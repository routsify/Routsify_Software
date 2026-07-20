import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getRequestUserId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function text(value: unknown, max = 300) { return String(value ?? "").trim().slice(0, max); }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function optionalDate(value: unknown) { const raw = text(value, 10); return raw ? (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined) : null; }

export async function POST(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const name = text(source.name, 160);
  const currency = text(source.currency || "EUR", 3).toUpperCase();
  const baseCost = optionalNumber(source.base_cost);
  const taxRate = optionalNumber(source.tax_rate);
  const validFrom = optionalDate(source.valid_from);
  const validUntil = optionalDate(source.valid_until);
  if (name.length < 2) return NextResponse.json({ ok: false, error: "service_name_required" }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ ok: false, error: "invalid_currency" }, { status: 400 });
  if (baseCost === undefined || (baseCost !== null && baseCost < 0)) return NextResponse.json({ ok: false, error: "invalid_base_cost" }, { status: 400 });
  if (taxRate === undefined || (taxRate !== null && (taxRate < 0 || taxRate > 100))) return NextResponse.json({ ok: false, error: "invalid_tax_rate" }, { status: 400 });
  if (validFrom === undefined || validUntil === undefined || (validFrom && validUntil && validFrom > validUntil)) return NextResponse.json({ ok: false, error: "invalid_validity_dates" }, { status: 400 });

  const { supplierId } = await params;
  const db = getSupabaseAdminClient();
  const { data: supplier } = await db.from("suppliers").select("id").eq("id", supplierId).eq("organization_id", access.organizationId).maybeSingle();
  if (!supplier) return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404 });
  const actorId = await getRequestUserId(request);
  const { data, error } = await db.from("supplier_services").insert({
    organization_id: access.organizationId,
    supplier_id: supplierId,
    name,
    category: text(source.category, 100) || null,
    destination: text(source.destination, 120) || null,
    currency,
    unit: text(source.unit, 80) || null,
    base_cost: baseCost,
    tax_rate: taxRate,
    valid_from: validFrom,
    valid_until: validUntil,
    active: source.active !== false,
    notes: text(source.notes, 2000) || null,
    created_by: actorId,
  }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await db.from("audit_log").insert({ organization_id: access.organizationId, actor_id: actorId, entity_type: "supplier_service", entity_id: data.id, action: "supplier_service.created", after_data: data });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
