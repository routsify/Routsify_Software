import { createBrowserClient } from "@supabase/ssr";

const urlVar = "NEXT_PUBLIC_SUPABASE_URL";
const keyVar = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export function hasSupabaseBrowserEnv() {
  return Boolean(process.env[urlVar] && process.env[keyVar]);
}

export function getSupabaseBrowserClient() {
  const url = process.env[urlVar];
  const key = process.env[keyVar];
  if (!url || !key) throw new Error("Missing public Supabase browser configuration");
  return createBrowserClient(url, key);
}

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function isBrowserDemoAccessAllowed() {
  return isDemoMode() && process.env.NEXT_PUBLIC_ALLOW_PUBLIC_DEMO === "true";
}
