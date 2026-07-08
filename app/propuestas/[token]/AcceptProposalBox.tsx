"use client";

import { useState } from "react";

export function AcceptProposalBox({ total }: { total: number }) {
  const [accepted, setAccepted] = useState(false);

  if (accepted) {
    return (
      <div>
        <div className="eyebrow">Propuesta aceptada</div>
        <div className="metric">Aceptada</div>
        <p>Hemos registrado la aceptación en modo demo. El siguiente paso operativo será preparar contrato, documentación mínima y pago.</p>
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
      <button className="btn" style={{ width: "100%" }} onClick={() => setAccepted(true)}>Aceptar propuesta</button>
      <p><small>Modo demo: no se firma ni se cobra todavía. En fase real se guardará la aceptación con token seguro.</small></p>
    </div>
  );
}
