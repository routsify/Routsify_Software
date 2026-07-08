import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

export function getSupabaseBrowserClient() {
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}
