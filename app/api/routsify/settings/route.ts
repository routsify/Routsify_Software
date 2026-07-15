import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { defaultSettings, settingsSummary, validateSetting, type AppSetting } from "@/lib/settings-master";
import { enforceProtectedSettingValue, isProtectedSetting } from "@/lib/settings-invariants";

function mergeSettings(rows: Record<string, unknown>[]) {
  return defaultSettings.map((setting) => {
    const stored = rows.find((row) => row.key === setting.key);
    const storedValue = stored?.value === null || stored?.value === undefined ? setting.value : stored.value as AppSetting["value"];
    return {
      ...setting,
      value: enforceProtectedSettingValue(setting.key, storedValue) as AppSetting["value"],
      editable: setting.editable && !isProtectedSetting(setting.key),
      updatedAt: stored?.updated_at ? String(stored.updated_at) : setting.updatedAt,
    };
  });
}

function normalizeValue(base: AppSetting, value: unknown): AppSetting["value"] {
  if (base.valueType === "boolean") return value === true;
  if (base.valueType === "number") return Number(value);
  if (base.valueType === "multi_select") return Array.isArray(value) ? value.map((item) => String(item)) : [];
  if (base.valueType === "json") return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: true, mode: "local", data: [], summary: settingsSummary([]) });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient().from("routsify_settings").select("*").eq("organization_id", organizationId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const settings = mergeSettings((data || []) as Record<string, unknown>[]);
  return NextResponse.json({ ok: true, mode: "supabase", data: settings, summary: settingsSummary(settings) });
}

export async function PATCH(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body.settings) ? body.settings as Array<{ key?: string; value?: unknown }> : [];
  if (!updates.length) return NextResponse.json({ ok: true, data: [] });

  const allowed = new Map(defaultSettings.filter((setting) => setting.editable && !setting.isSensitive && !isProtectedSetting(setting.key)).map((setting) => [setting.key, setting]));
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const supabase = getSupabaseAdminClient();
  const saved: AppSetting[] = [];

  for (const update of updates) {
    const key = String(update.key || "");
    const base = allowed.get(key);
    if (!base) return NextResponse.json({ ok: false, error: `setting_not_editable:${key}` }, { status: 400 });

    const value = normalizeValue(base, update.value === undefined ? base.value : update.value);
    const candidate: AppSetting = { ...base, value };
    const validationError = validateSetting(candidate);
    if (validationError) return NextResponse.json({ ok: false, error: validationError, key }, { status: 400 });

    const { data: previous } = await supabase
      .from("routsify_settings")
      .select("value")
      .eq("organization_id", organizationId)
      .eq("key", base.key)
      .maybeSingle();

    const updatedAt = new Date().toISOString();
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
      updated_by: access.actorId,
      updated_at: updatedAt,
    };

    const { error } = await supabase.from("routsify_settings").upsert(payload, { onConflict: "organization_id,key" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    await supabase.from("routsify_settings_audit_log").insert({
      organization_id: organizationId,
      module: base.module,
      key: base.key,
      setting_key: base.key,
      old_value: previous?.value ?? base.defaultValue,
      new_value: value,
      action: "update",
      actor_id: access.actorId,
      event_name: base.eventName || "settings.updated",
      requires_recalculation: Boolean(base.requiresRecalculation),
    });

    saved.push({ ...base, value, updatedAt });
  }

  return NextResponse.json({ ok: true, mode: "supabase", data: saved });
}
