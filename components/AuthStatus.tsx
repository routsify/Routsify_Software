"use client";

import { useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-browser";

type AuthStatusProps = {
  email?: string | null;
  role?: string | null;
};

export function AuthStatus({ email = null, role = null }: AuthStatusProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      if (hasSupabaseBrowserEnv()) {
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut({ scope: "global" });
      }
    } finally {
      window.location.replace("/login");
    }
  }

  if (!email) return null;

  return (
    <div className="auth-status">
      <span className="badge">{email}</span>
      {role ? <span className="badge">{role}</span> : null}
      <button className="btn secondary" type="button" onClick={signOut} disabled={signingOut}>{signingOut ? "Saliendo..." : "Salir"}</button>
    </div>
  );
}
