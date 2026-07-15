import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function text(value: unknown, max = 240) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, max) : null;
}

const select = "id,name,category,email,phone,tax_id,country,billing_address,notes,active,holded_contact_id,created_at,updated_at";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { data, error } = await getSupabaseAdminClient().from("suppliers")
    .select(select)
    .eq("organization_id", access.organizationId)
    .order("active", { ascending: false })
    .order("name", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const name = text(source.name, 160);
  if (!name || name.length < 2) return NextResponse.json({ ok: false, error: "supplier_name_required" }, { status: 400 });

  const payload = {
    organization_id: access.organizationId,
    name,
    category: text(source.category, 100),
    email: text(source.email, 240),
    phone: text(source.phone, 80),
    tax_id: text(source.tax_id, 80),
    country: text(source.country, 100),
    billing_address: source.billing_address && typeof source.billing_address === "object" ? source.billing_address : {},
    notes: text(source.notes, 2000),
    active: source.active === undefined ? true : Boolean(source.active),
  };

  const db = getSupabaseAdminClient();
  const { data, error } = await db.from("suppliers").insert(payload).select(select).single();
  if (error?.code === "23505") {
    const { data: existing } = await db.from("suppliers").select(select).eq("organization_id", access.organizationId).ilike("name", name).limit(1).maybeSingle();
    return NextResponse.json({ ok: false, error: "supplier_already_exists", existing: existing || null }, { status: 409 });
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
