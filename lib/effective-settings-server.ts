import { cache } from "react";
import { defaultSettings, type AppSetting } from "@/lib/settings-master";
import { enforceProtectedSettingValue } from "@/lib/settings-invariants";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type SettingValue = AppSetting["value"];

const definitions = new Map(defaultSettings.map((setting) => [setting.key, setting]));

function unwrapStoredValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return (value as { value?: unknown }).value;
  }
  return value;
}

function effectiveValue(key: string, stored: unknown): SettingValue | undefined {
  const definition = definitions.get(key);
  const value = unwrapStoredValue(stored);
  if (!definition) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || Array.isArray(value) || (value && typeof value === "object")) {
      return value as SettingValue;
    }
    return undefined;
  }
  const resolved = value === null || value === undefined ? definition.defaultValue : value;
  return enforceProtectedSettingValue(key, resolved) as SettingValue;
}

const loadRows = cache(async (organizationId: string) => {
  const { data, error } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return new Map((data || []).map((row) => [String(row.key), row.value]));
});

export async function loadEffectiveSettings(organizationId: string) {
  const stored = await loadRows(organizationId);

  function get(key: string): SettingValue | undefined {
    const definition = definitions.get(key);
    if (!definition) return stored.has(key) ? effectiveValue(key, stored.get(key)) : undefined;
    return effectiveValue(key, stored.has(key) ? stored.get(key) : definition.defaultValue);
  }

  return {
    get,
    string(key: string, fallback = "") {
      const value = get(key);
      return typeof value === "string" ? value : fallback;
    },
    number(key: string, fallback = 0) {
      const value = Number(get(key));
      return Number.isFinite(value) ? value : fallback;
    },
    boolean(key: string, fallback = false) {
      const value = get(key);
      return typeof value === "boolean" ? value : fallback;
    },
    stringArray(key: string, fallback: string[] = []) {
      const value = get(key);
      return Array.isArray(value) ? value.map(String) : fallback;
    },
  };
}

export async function getEffectiveSetting(organizationId: string, key: string) {
  const settings = await loadEffectiveSettings(organizationId);
  return settings.get(key);
}
