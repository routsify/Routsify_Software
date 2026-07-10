"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv, isBrowserDemoAccessAllowed } from "@/lib/supabase-browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canUseAuth = hasSupabaseBrowserEnv();
  const canUseDemo = isBrowserDemoAccessAllowed();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUseAuth) {
      setMessage("Faltan las variables públicas de Supabase. Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en la plataforma.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.rpc("ensure_profile_for_current_user");
    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/hoy");
    router.refresh();
  }

  function enterDemo() {
    router.push("/hoy");
    router.refresh();
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {!canUseAuth ? <p style={{ color: "var(--danger)" }}>Login real pendiente de variables públicas Supabase en esta plataforma.</p> : null}
      {canUseDemo ? <p style={{ color: "var(--warning)" }}>Modo demo explícito activo. Puedes entrar sin usuario.</p> : null}
      <label>
        Email
        <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required={canUseAuth} disabled={!canUseAuth} />
      </label>
      <label>
        Contraseña
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required={canUseAuth} disabled={!canUseAuth} />
      </label>
      {message ? <p style={{ color: "var(--danger)" }}>{message}</p> : null}
      <button className="btn" type="submit" disabled={loading || !canUseAuth}>{loading ? "Entrando..." : "Entrar"}</button>
      {canUseDemo ? <button className="btn secondary" type="button" onClick={enterDemo}>Entrar en demo</button> : null}
    </form>
  );
}
