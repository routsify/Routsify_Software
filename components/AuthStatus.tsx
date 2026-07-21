"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-browser";

type AuthStatusProps = {
  email?: string | null;
  role?: string | null;
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  direction: "Dirección",
  sales: "Ventas",
  operations: "Operaciones",
  billing: "Facturación",
  viewer: "Lectura",
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
      <span className="auth-identity" title={email}><strong>{email.split("@")[0]}</strong>{role ? <small>{roleLabels[role] || role}</small> : null}</span>
      <button className="icon-control" aria-label="Cerrar sesión" title="Cerrar sesión" type="button" onClick={signOut} disabled={signingOut}><LogOut aria-hidden="true" size={18} /></button>
    </div>
  );
}
