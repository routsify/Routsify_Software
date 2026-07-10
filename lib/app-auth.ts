import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { isPublicDemoAllowed, shouldBlockDemoInProduction } from "@/lib/runtime-mode";

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

function isDemoAccessAllowed() {
  return isPublicDemoAllowed() && !shouldBlockDemoInProduction();
}

export async function requireAppSession() {
  if (isDemoAccessAllowed()) {
    return { email: null, role: "demo" };
  }

  const config = publicSupabaseConfig();
  if (!config) redirect("/login");

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

  const { data: profile } = await supabase.rpc("ensure_profile_for_current_user");
  return { email: data.user.email ?? null, role: profile?.role ?? null };
}
