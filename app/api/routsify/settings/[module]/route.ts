import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { defaultSettings, moduleFor } from "@/lib/settings-master";

export async function GET(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { module } = await params;

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ module: moduleFor(module), data: defaultSettings.filter((setting) => setting.module === module) });
  }

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient().from("routsify_settings").select("*").eq("organization_id", organizationId).eq("module", module);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, module: moduleFor(module), data: data || [] });
}

export async function PATCH() {
  return NextResponse.json({ ok: false, error: "use_settings_root_endpoint" }, { status: 410 });
}
