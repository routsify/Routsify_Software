import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const keys = ["company.name", "theme.primary", "theme.sidebar", "theme.accent", "theme.background", "theme.surface", "theme.radius", "theme.density", "theme.font", "theme.sidebar_width", "navigation.modules"];

export async function loadAppTheme(organizationId: string) {
  const { data } = await getSupabaseAdminClient().from("routsify_settings").select("key,value").eq("organization_id", organizationId).in("key", keys);
  const values = new Map((data || []).map((row) => [String(row.key), row.value]));
  const text = (key: string, fallback: string) => typeof values.get(key) === "string" ? String(values.get(key)) : fallback;
  const numeric = (key: string, fallback: number) => Number.isFinite(Number(values.get(key))) ? Number(values.get(key)) : fallback;
  const navigation = values.get("navigation.modules");
  return {
    companyName: text("company.name", "Routsify"),
    primary: text("theme.primary", "#379237"),
    sidebar: text("theme.sidebar", "#14532d"),
    accent: text("theme.accent", "#f0a528"),
    background: text("theme.background", "#f7faf7"),
    surface: text("theme.surface", "#ffffff"),
    radius: numeric("theme.radius", 16),
    density: text("theme.density", "comfortable"),
    font: text("theme.font", "Inter"),
    sidebarWidth: numeric("theme.sidebar_width", 236),
    navigation: Array.isArray(navigation) ? navigation.map(String) : null,
  };
}
