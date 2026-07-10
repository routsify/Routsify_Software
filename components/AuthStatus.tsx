"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv, isDemoMode } from "@/lib/supabase-browser";

type ProfileState = {
  email: string | null;
  role: string | null;
};

export function AuthStatus() {
  const router = useRouter();
  const [state, setState] = useState<ProfileState>({ email: null, role: null });
  const [loading, setLoading] = useState(!isDemoMode());
  const [signingOut, setSigningOut] = useState(false);

  async function loadProfile() {
    if (isDemoMode() || !hasSupabaseBrowserEnv()) {
      setState({ email: null, role: null });
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setState({ email: null, role: null });
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase.rpc("ensure_profile_for_current_user");
    setState({ email: userData.user.email ?? null, role: profile?.role ?? null });
    setLoading(false);
  }

  useEffect(() => {
    if (isDemoMode() || !hasSupabaseBrowserEnv()) {
      setState({ email: null, role: null });
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    void loadProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      if (hasSupabaseBrowserEnv()) {
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut({ scope: "global" });
      }
      setState({ email: null, role: null });
      router.replace("/login");
      router.refresh();
      window.setTimeout(() => window.location.assign("/login"), 120);
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) return <span className="badge">Comprobando sesión</span>;
  if (!state.email) return <Link className="btn secondary" href="/login">Entrar</Link>;

  return (
    <div className="auth-status">
      <span className="badge">{state.email}</span>
      {state.role ? <span className="badge">{state.role}</span> : null}
      <button className="btn secondary" type="button" onClick={signOut} disabled={signingOut}>{signingOut ? "Saliendo..." : "Salir"}</button>
    </div>
  );
}
