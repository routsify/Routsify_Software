"use client";

import { FormEvent, useMemo, useState } from "react";

type Proposal = {
  id: string;
  status?: string | null;
  case_id: string;
  current_version_id?: string | null;
  proposal_versions?: { total_sale?: number | string | null; locked?: boolean | null } | Array<{ total_sale?: number | string | null; locked?: boolean | null }> | null;
};

type PaymentLink = {
  id: string;
  proposal_version_id?: string | null;
  external_url: string;
  amount: number | string;
  currency?: string | null;
  status?: string | null;
  confirmed_at?: string | null;
};

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ManualPaymentPanel({ caseId, proposals, initialLinks }: { caseId: string; proposals: Proposal[]; initialLinks: PaymentLink[] }) {
  const accepted = useMemo(() => proposals.find((item) => item.status === "accepted" && item.current_version_id) || null, [proposals]);
  const version = accepted ? (Array.isArray(accepted.proposal_versions) ? accepted.proposal_versions[0] : accepted.proposal_versions) : null;
  const [links, setLinks] = useState(initialLinks);
  const [url, setUrl] = useState("");
  const [amount, setAmount] = useState(String(numberValue(version?.total_sale) || ""));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) return;
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${accepted.id}/payment-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ external_url: url, amount: numberValue(amount) }),
    });
    const result = await response.json().catch(() => null); setBusy(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo guardar el enlace."));
    setLinks((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
    setUrl(""); setMessage("Enlace de Teya guardado y vinculado al presupuesto aceptado.");
  }

  async function confirm(link: PaymentLink) {
    const paymentReference = reference.trim();
    if (!paymentReference) return setMessage("Introduce la referencia real del cobro antes de confirmarlo.");
    if (!window.confirm("¿Confirmar que el pago se ha recibido? Esta acción prepara la proforma total en Holded.")) return;
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/payment-links/${link.id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: paymentReference, amount: numberValue(link.amount) }),
    });
    const result = await response.json().catch(() => null); setBusy(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo confirmar el pago."));
    setLinks((current) => current.map((item) => item.id === link.id ? { ...item, status: "confirmed", confirmed_at: new Date().toISOString() } : item));
    setReference(""); setMessage("Pago confirmado. La proforma por el total del viaje ha quedado preparada para Holded.");
  }

  if (!accepted) return <section className="card"><h2>Enlace de pago</h2><p>Primero debe existir un presupuesto aceptado y bloqueado para este expediente.</p></section>;

  return <section className="workspace-grid">
    <div className="card">
      <div className="eyebrow">Teya · gestión manual</div>
      <h2>Añadir enlace de pago</h2>
      <p>Pega la URL creada en Teya. Quedará vinculada a la versión aceptada del presupuesto.</p>
      <form className="form" onSubmit={saveLink}>
        <label>URL de Teya<input className="input" type="url" required placeholder="https://..." value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label>Importe<input className="input" type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <button className="btn" disabled={busy}>{busy ? "Guardando..." : "Guardar enlace"}</button>
      </form>
    </div>
    <div className="card workspace-wide">
      <h2>Enlaces y pagos</h2>
      <label>Referencia del cobro<input className="input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia de Teya o extracto bancario" /></label>
      {links.length ? <div className="table-scroll"><table><thead><tr><th>URL</th><th>Importe</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{links.map((link) => <tr key={link.id}><td><a href={link.external_url} target="_blank" rel="noreferrer">Abrir enlace</a></td><td>{new Intl.NumberFormat("es-ES", { style: "currency", currency: link.currency || "EUR" }).format(numberValue(link.amount))}</td><td>{link.status || "created"}</td><td>{link.status === "confirmed" ? "Confirmado" : <button className="btn secondary" type="button" disabled={busy} onClick={() => void confirm(link)}>Marcar pagado</button>}</td></tr>)}</tbody></table></div> : <p>No hay enlaces guardados.</p>}
      {message ? <p className="client-message" role="status">{message}</p> : null}
      <p className="field-help">La factura final permanecerá bloqueada hasta cinco días después del viaje y hasta que todas las facturas de proveedores estén aprobadas.</p>
    </div>
  </section>;
}
