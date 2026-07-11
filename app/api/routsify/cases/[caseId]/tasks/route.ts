import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

const priorities = new Set(["low", "normal", "high", "urgent"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  const title = String(body?.title || "").trim();
  const priority = String(body?.priority || "normal");
  if (!title || !priorities.has(priority)) return NextResponse.json({ ok: false, error: "invalid_task" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase.from("cases").select("id,client_id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const { data, error } = await supabase.from("tasks").insert({
    organization_id: organizationId,
    case_id: caseId,
    client_id: caseRow.client_id,
    title,
    status: "pending",
    priority,
    due_at: body?.due_at ? String(body.due_at) : null,
    payload: { source: "manual" },
  }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
