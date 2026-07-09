"use client";

import { useState } from "react";

const fiscalModes = ["manual_review", "proforma_on_payment", "invoice_on_advance", "final_invoice_after_trip"];
const confidenceLevels = ["alta", "media", "baja"];
const retentionOptions = ["30 días", "60 días", "90 días"];

export function SettingsManager() {
  const [filloutEnabled, setFilloutEnabled] = useState(true);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [holdedMode, setHoldedMode] = useState("manual_review");
  const [globalMargin, setGlobalMargin] = useState("25");
  const [ocrConfidence, setOcrConfidence] = useState("media");
  const [retention, setRetention] = useState("60 días");
  const [message, setMessage] = useState<string | null>(null);

  function saveDemoSettings() {
    setMessage("Ajustes guardados en modo demo. En real se persistirán con auditoría, RLS y control de rol técnico/admin.");
  }

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="eyebrow">Backoffice demo editable</div>
      <h2>Parámetros que gobiernan el flujo</h2>
      <p>Estos controles no conectan Supabase real todavía. Sirven para dejar definida la lógica exacta que se persistirá después.</p>
      <div className="grid grid-3">
        <label>Fillout<input type="checkbox" checked={filloutEnabled} onChange={(event) => setFilloutEnabled(event.target.checked)} /> Webhook activo</label>
        <label>Booking<input type="checkbox" checked={bookingEnabled} onChange={(event) => setBookingEnabled(event.target.checked)} /> API activa</label>
        <label>Fiscal mode<select value={holdedMode} onChange={(event) => setHoldedMode(event.target.value)}>{fiscalModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
        <label>Margen global %<input className="input" type="number" min="0" max="95" value={globalMargin} onChange={(event) => setGlobalMargin(event.target.value)} /></label>
        <label>Confianza OCR mínima<select value={ocrConfidence} onChange={(event) => setOcrConfidence(event.target.value)}>{confidenceLevels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
        <label>Retención documentos<select value={retention} onChange={(event) => setRetention(event.target.value)}>{retentionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button className="btn" type="button" onClick={saveDemoSettings}>Guardar ajustes demo</button>
        {message ? <p>{message}</p> : null}
      </div>
      <table style={{ marginTop: 18 }}><tbody><tr><th>Regla</th><td>Los cambios de fiscalidad, margen, OCR, roles y retención deben auditarse cuando haya datos reales.</td></tr><tr><th>Holded</th><td>Solo server-side, nunca con claves NEXT_PUBLIC.</td></tr><tr><th>OCR</th><td>Confianza media/baja exige revisión humana.</td></tr></tbody></table>
    </section>
  );
}
