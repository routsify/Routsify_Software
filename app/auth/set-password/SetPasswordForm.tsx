"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-browser";

type Notice = { tone: "ok" | "error"; text: string } | null;

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || value.startsWith("/auth")) return "/hoy";
  return value;
}

export function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [nextPath, setNextPath] = useState("/hoy");
  const canUseAuth = hasSupabaseBrowserEnv();

  useEffect(() => {
    const resolvedNext = safeNext(new URLSearchParams(window.location.search).get("next"));
    setNextPath(resolvedNext);
    if (!canUseAuth) {
      setNotice({ tone: "error", text: "El acceso no está configurado correctamente." });
      return;
    }

    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setNotice({ tone: "error", text: "El enlace no es válido o ha caducado. Solicita uno nuevo." });
        return;
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [canUseAuth]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (password.length < 10) {
      setNotice({ tone: "error", text: "La contraseña debe tener al menos 10 caracteres." });
      return;
    }
    if (password !== confirmPassword) {
      setNotice({ tone: "error", text: "Las contraseñas no coinciden." });
      return;
    }
    if (!canUseAuth || !ready) {
      setNotice({ tone: "error", text: "El enlace no es válido o ha caducado. Solicita uno nuevo." });
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setNotice({ tone: "error", text: "No se ha podido actualizar la contraseña." });
      return;
    }

    setNotice({ tone: "ok", text: "Contraseña actualizada. Entrando..." });
    window.location.replace(nextPath);
  }

  return (
    <div className="login-form-wrap">
      {notice ? <p className={`login-notice ${notice.tone}`}>{notice.text}</p> : null}
      <form className="form" onSubmit={submit}>
        <label>
          Nueva contraseña
          <div className="password-field">
            <input className="input" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 10 caracteres" required />
            <button className="btn secondary" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ocultar" : "Ver"}</button>
          </div>
        </label>
        <label>
          Repetir contraseña
          <input className="input" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite la contraseña" required />
        </label>
        <button className="btn" type="submit" disabled={loading || !ready}>{loading ? "Guardando..." : "Guardar contraseña"}</button>
      </form>
    </div>
  );
}
