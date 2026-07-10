"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv, isBrowserDemoAccessAllowed } from "@/lib/supabase-browser";

type Mode = "login" | "forgot";
type Notice = { tone: "ok" | "error"; text: string } | null;

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/hoy";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/hoy");
  const canUseAuth = hasSupabaseBrowserEnv();
  const canUseDemo = isBrowserDemoAccessAllowed();

  useEffect(() => {
    setNextPath(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setNotice(null);

    if (!normalizedEmail || !password) {
      setNotice({ tone: "error", text: "Introduce tu email y contraseña." });
      return;
    }

    if (!canUseAuth) {
      setNotice({ tone: "error", text: "El acceso no está disponible en este momento." });
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    if (error || !data.session) {
      setLoading(false);
      setNotice({ tone: "error", text: "Email o contraseña incorrectos." });
      return;
    }

    const { error: profileError } = await supabase.rpc("ensure_profile_for_current_user");
    if (profileError) {
      setLoading(false);
      setNotice({ tone: "error", text: "No se pudo completar el acceso." });
      return;
    }

    setNotice({ tone: "ok", text: "Acceso correcto." });
    router.replace(nextPath);
    router.refresh();
  }

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setNotice(null);

    if (!normalizedEmail) {
      setNotice({ tone: "error", text: "Introduce tu email." });
      return;
    }

    if (!canUseAuth) {
      setNotice({ tone: "error", text: "No se pudo enviar el enlace." });
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/login` });
    setLoading(false);

    if (error) {
      setNotice({ tone: "error", text: "No se pudo enviar el enlace." });
      return;
    }

    setNotice({ tone: "ok", text: "Si el email existe, recibirás un enlace para recuperar tu contraseña." });
  }

  function enterDemo() {
    router.replace("/hoy");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {notice ? <p className="client-message" style={{ color: notice.tone === "error" ? "var(--danger)" : "var(--success)" }}>{notice.text}</p> : null}

      {mode === "login" ? (
        <form className="form" onSubmit={login}>
          <label>
            Email
            <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required />
          </label>

          <label>
            Contraseña
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input className="input" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" required />
              <button className="btn secondary" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ocultar" : "Ver"}</button>
            </div>
          </label>

          <button className="btn" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
          <button className="link-button" type="button" onClick={() => { setMode("forgot"); setNotice(null); }}>¿Has olvidado tu contraseña?</button>
          {canUseDemo ? <button className="btn secondary" type="button" onClick={enterDemo}>Entrar en demo</button> : null}
        </form>
      ) : null}

      {mode === "forgot" ? (
        <form className="form" onSubmit={recover}>
          <label>
            Email
            <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required />
          </label>
          <button className="btn" type="submit" disabled={loading}>{loading ? "Enviando..." : "Enviar enlace"}</button>
          <button className="link-button" type="button" onClick={() => { setMode("login"); setNotice(null); }}>Volver al login</button>
        </form>
      ) : null}
    </div>
  );
}
