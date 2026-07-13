import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

const requestUserCache = new WeakMap<NextRequest, Promise<string | null>>();

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function getRequestUserId(request: NextRequest) {
  const cached = requestUserCache.get(request);
  if (cached) return cached;

  const pending = (async () => {
    const config = publicSupabaseConfig();
    if (!config) return null;
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || null;
  })();

  requestUserCache.set(request, pending);
  return pending;
}

export async function resolveOrganizationId(request: NextRequest, fallback = "") {
  // requireInternalAccess already validated this organization. Returning it
  // avoids another auth request and another profile query in every API call.
  if (fallback) return fallback;
  if (!hasSupabaseAdminEnv()) return fallback;

  const userId = await getRequestUserId(request);
  const admin = getSupabaseAdminClient();
  if (userId) {
    const { data: profile } = await admin.from("profiles").select("organization_id").eq("user_id", userId).maybeSingle();
    if (profile?.organization_id) return profile.organization_id as string;
  }

  const { data: org } = await admin.from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (org?.id as string | undefined) || fallback;
}
