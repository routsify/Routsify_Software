import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

const travelerTypes = new Set(["adult", "child", "infant"]);
function text(value: unknown) { return String(value || "").trim(); }

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const firstName = text(source.first_name);
  const lastName = text(source.last_name);
  const travelerType = text(source.traveler_type) || "adult";
  if (!firstName || !lastName || !travelerTypes.has(travelerType)) return NextResponse.json({ ok: false, error: "invalid_traveler" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase.from("cases").select("id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const { data, error } = await supabase.from("travelers").insert({
    organization_id: organizationId,
    case_id: caseId,
    traveler_type: travelerType,
    first_name: firstName,
    last_name: lastName,
    birth_date: text(source.birth_date) || null,
    nationality: text(source.nationality) || null,
    document_country: text(source.document_country) || null,
    document_number: text(source.document_number) || null,
    document_expires_at: text(source.document_expires_at) || null,
  }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: "traveler.created", title: `Viajero añadido: ${firstName} ${lastName}`, payload: { traveler_id: data.id }, created_by: actorId });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const travelerId = text(source.id);
  if (!travelerId) return NextResponse.json({ ok: false, error: "traveler_required" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["first_name", "last_name", "birth_date", "nationality", "document_country", "document_number", "document_expires_at", "review_status"] as const) if (key in source) patch[key] = text(source[key]) || null;
  if (source.traveler_type && travelerTypes.has(text(source.traveler_type))) patch.traveler_type = text(source.traveler_type);
  const { data, error } = await getSupabaseAdminClient().from("travelers").update(patch).eq("id", travelerId).eq("case_id", caseId).eq("organization_id", organizationId).select("*").maybeSingle();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "traveler_not_found" }, { status: error ? 400 : 404 });
  return NextResponse.json({ ok: true, data });
}
