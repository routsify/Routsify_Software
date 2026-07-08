"use client";

import { useState } from "react";

type AcceptState = "idle" | "saving" | "accepted" | "error";

export function AcceptProposalBox({ total, token }: { total: number; token: string }) {
  const [state, setState] = useState<AcceptState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function acceptProposal() {
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/propuestas/${encodeURIComponent(token)}/accept`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "No se ha podido registrar la aceptación.");
      setState("accepted");
      setMessage(payload.message || "Propuesta aceptada.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Error registrando la aceptación.");
    }
  }

  if (state === "accepted") {
    return (
      <div>
        <div className="eyebrow">Propuesta aceptada</div>
        <div className="metric">Aceptada</div>
        <p>{message || "Hemos registrado la aceptación. El siguiente paso operativo será preparar contrato, documentación mínima y pago."}</p>
        <div style={{ display: "grid", gap: 8 }}>
          <span className="badge">Versión bloqueada</span>
          <span className="badge">Contrato pendiente</span>
          <span className="badge">Pago pendiente</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="eyebrow">Inversión total</div>
      <div className="metric">{total.toLocaleString("es-ES")} €</div>
      <p>Diseño, reservas coordinadas y soporte operativo. La versión aceptada quedará bloqueada y auditable.</p>
      <button className="btn" style={{ width: "100%" }} onClick={acceptProposal} disabled={state === "saving"}>{state === "saving" ? "Registrando..." : "Aceptar propuesta"}</button>
      {message ? <p><small>{message}</small></p> : <p><small>En modo demo registra la aceptación sin cobro. En modo real bloquea la versión mediante token seguro.</small></p>}
    </div>
  );
}
