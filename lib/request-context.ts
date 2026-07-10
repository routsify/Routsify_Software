import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function getRequestUserId(request: NextRequest) {
  const config = publicSupabaseConfig();
  if (!config) return null;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll() {},
    },
  });

  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function resolveOrganizationId(request: NextRequest, fallback: string) {
  if (!hasSupabaseAdminEnv()) return fallback;
  const userId = await getRequestUserId(request);
  const admin = getSupabaseAdminClient();

  if (userId) {
    const { data: profile } = await admin.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (profile?.organization_id) return profile.organization_id as string;
  }

  const { data: org } = await admin.from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (org?.id as string | undefined) || fallback;
}
