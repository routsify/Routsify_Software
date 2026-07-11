import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ data: [] });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient()
    .from("routsify_settings_audit_log")
    .select("id,setting_key,module,old_value,new_value,event_name,requires_recalculation,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: data || [] });
}
