import { createBrowserClient } from "@supabase/ssr";

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function supabaseBrowserKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function hasSupabaseBrowserEnv() {
  return Boolean(supabaseUrl() && supabaseBrowserKey());
}

export function getSupabaseBrowserClient() {
  const url = supabaseUrl();
  const key = supabaseBrowserKey();
  if (!url || !key) throw new Error("Missing public Supabase browser configuration");
  return createBrowserClient(url, key);
}
