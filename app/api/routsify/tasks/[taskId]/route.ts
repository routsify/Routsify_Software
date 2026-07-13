import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedStatuses = new Set(["pending", "in_progress", "done", "cancelled"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "");
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_task_status" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient()
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "task_not_found" }, { status: error ? 400 : 404 });
  return NextResponse.json({ ok: true, data });
}
