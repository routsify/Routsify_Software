"use client";

import { useState } from "react";

type AcceptState = "idle" | "saving" | "accepted" | "error";

export function AcceptProposalBox({ total, token, initialAccepted = false, clientName = "", clientEmail = "" }: { total: number; token: string; initialAccepted?: boolean; clientName?: string; clientEmail?: string }) {
  const [state, setState] = useState<AcceptState>(initialAccepted ? "accepted" : "idle");
  const [name, setName] = useState(clientName);
  const [email, setEmail] = useState(clientEmail);
  const [terms, setTerms] = useState(false);
  const [message, setMessage] = useState<string | null>(initialAccepted ? "Esta propuesta ya fue aceptada." : null);

  async function acceptProposal() {
    if (name.trim().length < 2) return setMessage("Indica el nombre de la persona que acepta.");
    if (!terms) return setMessage("Debes confirmar la aceptación de la propuesta.");
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/propuestas/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acceptor_name: name.trim(), acceptor_email: email.trim() || null, terms_accepted: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "No se ha podido registrar la aceptación.");
      setState("accepted");
      setMessage(payload.message || "Propuesta aceptada.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Error registrando la aceptación.");
    }
  }

  if (state === "accepted") {
    return <div><div className="eyebrow">Propuesta aceptada</div><div className="metric">Aceptada</div><p>{message}</p><div style={{ display: "grid", gap: 8 }}><span className="badge">Aceptación registrada</span><span className="badge">Versión bloqueada</span><span className="badge">Contrato en preparación</span></div></div>;
  }

  return (
    <div>
      <div className="eyebrow">Inversión total</div>
      <div className="metric">{total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</div>
      <p>Revisa los servicios incluidos. Al aceptar se registrará la conformidad y esta versión quedará bloqueada.</p>
      <div className="form" style={{ marginTop: 18 }}>
        <label>Nombre de quien acepta *<input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Email de confirmación<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label style={{ display: "flex", gridTemplateColumns: "auto 1fr", alignItems: "flex-start" }}><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} style={{ width: 18, marginTop: 2 }} /><span>Acepto esta propuesta, sus servicios, importes y condiciones indicadas.</span></label>
        <button className="btn" style={{ width: "100%" }} type="button" onClick={() => void acceptProposal()} disabled={state === "saving"}>{state === "saving" ? "Registrando..." : "Aceptar propuesta"}</button>
      </div>
      {message ? <p role="status"><small>{message}</small></p> : <p><small>El acceso es privado y la aceptación queda registrada con fecha y evidencia técnica.</small></p>}
    </div>
  );
}
