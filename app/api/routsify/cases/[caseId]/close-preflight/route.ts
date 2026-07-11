import { NextRequest, NextResponse } from "next/server";
import { requireInternalAccess, jsonAccessDenied } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: found } = await supabase.from("cases").select("id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!found) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  const { data, error } = await supabase.rpc("operational_close_preflight", { target_case: caseId });
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data });
}
