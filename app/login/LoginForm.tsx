"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        Email
        <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Contraseña
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      {message ? <p style={{ color: "var(--danger)" }}>{message}</p> : null}
      <button className="btn" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
    </form>
  );
}
