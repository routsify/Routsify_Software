import { createClient } from "@supabase/supabase-js";

function supabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabaseAdminEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseSecretKey());
}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = supabaseSecretKey();

  if (!url || !secretKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase secret key");
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
