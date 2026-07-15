import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function text(value: unknown, max = 240) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, max) : null;
}

const select = "id,name,category,email,phone,tax_id,country,billing_address,notes,active,holded_contact_id,created_at,updated_at";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { supplierId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const db = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await db.from("suppliers").select("id,name").eq("id", supplierId).eq("organization_id", access.organizationId).maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
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

  const { data, error } = await db.from("suppliers").update(patch).eq("id", supplierId).eq("organization_id", access.organizationId).select(select).single();
  if (error?.code === "23505") return NextResponse.json({ ok: false, error: "supplier_already_exists" }, { status: 409 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
