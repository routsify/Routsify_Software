"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv, isDemoMode } from "@/lib/supabase-browser";

type ProfileState = {
  email: string | null;
  role: string | null;
};

export function AuthStatus() {
  const [state, setState] = useState<ProfileState>({ email: null, role: null });
  const [loading, setLoading] = useState(!isDemoMode());

  async function loadProfile() {
    if (isDemoMode() || !hasSupabaseBrowserEnv()) {
      setState({ email: null, role: "demo" });
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
      setState({ email: null, role: "demo" });
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
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setState({ email: null, role: null });
  }

  if (loading) return <span className="badge">Comprobando sesión</span>;
  if (state.role === "demo") return <span className="badge">Modo demo</span>;
  if (!state.email) return <Link className="btn secondary" href="/login">Entrar</Link>;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span className="badge">{state.email}</span>
      {state.role ? <span className="badge">{state.role}</span> : null}
      <button className="btn secondary" type="button" onClick={signOut}>Salir</button>
    </div>
  );
}
