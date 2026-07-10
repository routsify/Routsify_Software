"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv, isBrowserDemoAccessAllowed } from "@/lib/supabase-browser";

type Mode = "login" | "forgot";

type Notice = { tone: "ok" | "error" | "warn"; text: string } | null;

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/hoy";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/hoy");
  const canUseAuth = hasSupabaseBrowserEnv();
  const canUseDemo = isBrowserDemoAccessAllowed();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNext(params.get("next")));
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setNotice(null);
    if (!normalizedEmail || !secret) return setNotice({ tone: "error", text: "Introduce email y contraseña." });
    if (!canUseAuth) return setNotice({ tone: "error", text: "Faltan las variables públicas de Supabase en esta plataforma." });
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: secret });
    if (error || !data.session) {
      setLoading(false);
      return setNotice({ tone: "error", text: "No se pudo entrar. Revisa credenciales o confirma el usuario en Supabase." });
    }
    const { error: profileError } = await supabase.rpc("ensure_profile_for_current_user");
    if (profileError) {
      setLoading(false);
      return setNotice({ tone: "error", text: `Sesión creada, pero falló el perfil: ${profileError.message}` });
    }
    setNotice({ tone: "ok", text: "Acceso correcto. Entrando..." });
    router.replace(nextPath);
    router.refresh();
  }

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setNotice(null);
    if (!normalizedEmail) return setNotice({ tone: "error", text: "Escribe tu email para recuperar el acceso." });
    if (!canUseAuth) return setNotice({ tone: "error", text: "No se puede enviar recuperación porque Supabase no está configurado." });
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    setLoading(false);
    if (error) return setNotice({ tone: "error", text: "No se pudo enviar el enlace. Revisa la configuración de Auth en Supabase." });
    setNotice({ tone: "ok", text: "Si el email existe, recibirás un enlace seguro para recuperar el acceso." });
  }

  function enterDemo() {
    router.replace("/hoy");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <span className="badge">Acceso seguro</span>
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>Zona privada del equipo. Usa tu usuario de Supabase Auth.</p>
      </div>
      {!canUseAuth ? <p className="client-message" style={{ color: "var(--danger)" }}>Login real pendiente de variables públicas Supabase en esta plataforma.</p> : null}
      {canUseDemo ? <p className="client-message">Modo demo explícito activo. No usar con datos reales.</p> : null}
      {notice ? <p className="client-message" style={{ color: notice.tone === "error" ? "var(--danger)" : notice.tone === "ok" ? "var(--success)" : "var(--warning)" }}>{notice.text}</p> : null}

      {mode === "login" ? <form className="form" onSubmit={login}>
        <label>Email<input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required /></label>
        <label>Contraseña<div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}><input className="input" type={showSecret ? "text" : "password"} autoComplete="current-password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="Tu contraseña" required /><button className="btn secondary" type="button" onClick={() => setShowSecret((value) => !value)}>{showSecret ? "Ocultar" : "Ver"}</button></div></label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><button className="btn" type="submit" disabled={loading}>{loading ? "Verificando..." : "Entrar"}</button><button className="link-button" type="button" onClick={() => { setMode("forgot"); setNotice(null); }}>He olvidado mi contraseña</button></div>
        {canUseDemo ? <button className="btn secondary" type="button" onClick={enterDemo}>Entrar en demo</button> : null}
      </form> : null}

      {mode === "forgot" ? <form className="form" onSubmit={recover}>
        <label>Email de recuperación<input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required /></label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="btn" type="submit" disabled={loading}>{loading ? "Enviando..." : "Enviar enlace"}</button><button className="btn secondary" type="button" onClick={() => { setMode("login"); setNotice(null); }}>Volver al login</button></div>
      </form> : null}

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}><strong>Seguridad</strong><br/><small>Sesión compatible con middleware, perfiles internos, RLS y recuperación por email. Los errores no revelan información sensible.</small></div>
    </div>
  );
}
