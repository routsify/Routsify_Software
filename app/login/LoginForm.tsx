"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canUseAuth = hasSupabaseBrowserEnv();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUseAuth) {
      setMessage("Modo demo activo. Puedes entrar sin usuario con el botón Entrar en demo.");
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
      {!canUseAuth ? <p style={{ color: "var(--warning)" }}>Modo demo activo: no necesitas usuario. El login real se activará al configurar Supabase.</p> : null}
      <label>
        Email
        <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required={canUseAuth} disabled={!canUseAuth} />
      </label>
      <label>
        Contraseña
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required={canUseAuth} disabled={!canUseAuth} />
      </label>
      {message ? <p style={{ color: canUseAuth ? "var(--danger)" : "var(--warning)" }}>{message}</p> : null}
      <button className="btn" type="submit" disabled={loading || !canUseAuth}>{loading ? "Entrando..." : "Entrar"}</button>
      {!canUseAuth ? <button className="btn secondary" type="button" onClick={enterDemo}>Entrar en demo</button> : null}
    </form>
  );
}
