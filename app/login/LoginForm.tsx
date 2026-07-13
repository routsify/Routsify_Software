"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-browser";

type Mode = "login" | "forgot";
type Notice = { tone: "ok" | "error"; text: string } | null;

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/hoy";
  return value;
}

function loginErrorMessage(error: { code?: string; status?: number } | null) {
  if (!error) return "No se ha podido iniciar sesión.";
  if (error.code === "invalid_credentials" || error.status === 400) return "Email o contraseña incorrectos.";
  if (error.status === 429) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  return "No se ha podido conectar con el servicio de acceso. Vuelve a intentarlo.";
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/hoy");
  const canUseAuth = hasSupabaseBrowserEnv();

  useEffect(() => {
    const resolvedNext = safeNext(new URLSearchParams(window.location.search).get("next"));
    setNextPath(resolvedNext);

    if (!canUseAuth) return;
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) window.location.replace(resolvedNext);
    });
    return () => { cancelled = true; };
  }, [canUseAuth]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setNotice(null);

    if (!normalizedEmail || !password) {
      setNotice({ tone: "error", text: "Introduce tu email y contraseña." });
      return;
    }

    if (!canUseAuth) {
      setNotice({ tone: "error", text: "El acceso no está configurado correctamente." });
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (error || !data.session) {
        setLoading(false);
        setNotice({ tone: "error", text: loginErrorMessage(error) });
        return;
      }

      const { data: verified, error: verificationError } = await supabase.auth.getUser();
      if (verificationError || !verified.user) {
        await supabase.auth.signOut({ scope: "local" });
        setLoading(false);
        setNotice({ tone: "error", text: "La sesión no se ha podido verificar. Vuelve a intentarlo." });
        return;
      }

      setNotice({ tone: "ok", text: "Acceso correcto. Entrando…" });
      window.location.replace(nextPath);
    } catch {
      setLoading(false);
      setNotice({ tone: "error", text: "No se ha podido conectar con el servicio de acceso. Vuelve a intentarlo." });
    }
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
      setNotice({ tone: "error", text: "No se ha podido enviar el enlace." });
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/login` });
    setLoading(false);

    if (error) {
      setNotice({ tone: "error", text: "No se ha podido enviar el enlace." });
      return;
    }

    setNotice({ tone: "ok", text: "Si el email existe, recibirás un enlace para recuperar tu contraseña." });
  }

  return (
    <div className="login-form-wrap">
      {notice ? <p className={`login-notice ${notice.tone}`}>{notice.text}</p> : null}

      {mode === "login" ? (
        <form className="form" onSubmit={login}>
          <label>
            Email
            <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required />
          </label>

          <label>
            Contraseña
            <div className="password-field">
              <input className="input" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" required />
              <button className="btn secondary" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ocultar" : "Ver"}</button>
            </div>
          </label>

          <button className="btn" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
          <button className="link-button" type="button" onClick={() => { setMode("forgot"); setNotice(null); }}>¿Has olvidado tu contraseña?</button>
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
