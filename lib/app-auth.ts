import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function requireAppSession() {
  const config = publicSupabaseConfig();
  if (!config || !hasSupabaseAdminEnv()) redirect("/login");

  const cookieStore = await cookies();
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");

  const { data: profile, error: profileError } = await getSupabaseAdminClient()
    .from("profiles")
    .select("organization_id,role,full_name")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (profileError || !profile?.organization_id) redirect("/login");

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    role: profile.role ?? null,
    fullName: profile.full_name ?? null,
    organizationId: String(profile.organization_id),
  };
}
