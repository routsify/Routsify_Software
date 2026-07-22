import { loadEffectiveSettings } from "@/lib/effective-settings-server";

export async function loadAppTheme(organizationId: string) {
  const settings = await loadEffectiveSettings(organizationId);
  return {
    companyName: settings.string("company.name", "Routsify"),
    logoUrl: settings.string("company.logo_url", ""),
    primary: settings.string("theme.primary", "#379237"),
    sidebar: settings.string("theme.sidebar", "#14532d"),
    accent: settings.string("theme.accent", "#f0a528"),
    background: settings.string("theme.background", "#f7faf7"),
    surface: settings.string("theme.surface", "#ffffff"),
    radius: settings.number("theme.radius", 16),
    density: settings.string("theme.density", "comfortable"),
    font: settings.string("theme.font", "Inter"),
    sidebarWidth: settings.number("theme.sidebar_width", 236),
    navigation: settings.stringArray("navigation.modules", []),
  };
}

export async function loadDefaultPublicBrand() {
  const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const { data } = await getSupabaseAdminClient().from("routsify_settings").select("organization_id,value").eq("key", "company.logo_url").neq("value", '""').limit(1).maybeSingle();
  return { logoUrl: typeof data?.value === "string" ? data.value : "" };
}
