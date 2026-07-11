import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient().from("timeline_events").select("*").eq("case_id", caseId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  const title = String(body?.title || "").trim();
  const note = String(body?.note || body?.description || "").trim();
  const channel = String(body?.channel || "internal").trim();
  if (!title || !note) return NextResponse.json({ ok: false, error: "title_and_note_required" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase.from("cases").select("id,client_id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  const { data, error } = await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, client_id: caseRow.client_id, event_type: "communication.note", title, payload: { note, channel }, created_by: actorId }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await supabase.from("cases").update({ last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", caseId).eq("organization_id", organizationId);
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
