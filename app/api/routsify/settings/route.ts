import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { demoSettings, settingsSummary, type AppSetting } from "@/lib/settings-master";

function mergeSettings(rows: Record<string, unknown>[]) {
  return demoSettings.map((setting) => {
    const stored = rows.find((row) => row.key === setting.key);
    if (!stored) return setting;
    return {
      ...setting,
      value: stored.value === null || stored.value === undefined ? setting.value : stored.value as AppSetting["value"],
      updatedAt: stored.updated_at ? String(stored.updated_at) : setting.updatedAt,
    };
  });
}

export async function GET(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: true, mode: "local", data: [], summary: settingsSummary([]) });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient().from("routsify_settings").select("*").eq("organization_id", organizationId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const settings = mergeSettings((data || []) as Record<string, unknown>[]);
  return NextResponse.json({ ok: true, mode: "supabase", data: settings, summary: settingsSummary(settings) });
}

export async function PATCH(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body.settings) ? body.settings as Partial<AppSetting>[] : [];
  if (!updates.length) return NextResponse.json({ ok: true, data: [] });

  const allowed = new Map(demoSettings.filter((setting) => setting.editable && !setting.isSensitive).map((setting) => [setting.key, setting]));
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const saved: AppSetting[] = [];

  for (const update of updates) {
    const key = String(update.key || "");
    const base = allowed.get(key);
    if (!base) continue;
    const value = update.value === undefined ? base.value : update.value;
    const payload = {
      organization_id: organizationId,
      key: base.key,
      module: base.module,
      value,
      default_value: base.defaultValue,
      value_type: base.valueType,
      scope: base.scope,
      editable: base.editable,
      requires_recalculation: Boolean(base.requiresRecalculation),
      affected_modules: base.affectedModules || [base.module],
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("routsify_settings").upsert(payload, { onConflict: "organization_id,key" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    await supabase.from("routsify_settings_audit_log").insert({
      organization_id: organizationId,
      setting_key: base.key,
      module: base.module,
      new_value: value,
      actor_id: actorId,
      event_name: base.eventName || "settings.updated",
      requires_recalculation: Boolean(base.requiresRecalculation),
    });

    saved.push({ ...base, value, updatedAt: payload.updated_at });
  }

  return NextResponse.json({ ok: true, mode: "supabase", data: saved });
}
