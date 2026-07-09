export function hasSupabasePublicEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "false" || !hasSupabasePublicEnv();
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function isPublicDemoAllowed() {
  return process.env.ROUTSIFY_ALLOW_PUBLIC_DEMO === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function shouldBlockDemoInProduction() {
  return isProductionRuntime() && isDemoMode() && !isPublicDemoAllowed();
}

export function demoOrganizationId() {
  return process.env.DEMO_ORGANIZATION_ID || "00000000-0000-0000-0000-000000000001";
}
