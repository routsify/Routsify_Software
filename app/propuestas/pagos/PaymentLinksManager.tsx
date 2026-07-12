"use client";

import { FormEvent, useMemo, useState } from "react";

type PaymentLink = { id: string; external_url: string; amount: number; currency?: string | null; status?: string | null; confirmed_at?: string | null; created_at?: string | null };
type Proposal = { id: string; caseCode: string; clientName: string; destination: string; total: number; currency: string; paymentLinks: PaymentLink[] };

function money(value: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0));
}

export function PaymentLinksManager({ initialProposals }: { initialProposals: Proposal[] }) {
  const [proposals, setProposals] = useState(initialProposals);
  const [selectedId, setSelectedId] = useState(initialProposals[0]?.id || "");
  const [url, setUrl] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = proposals.find((item) => item.id === selectedId) || null;
  const link = useMemo(() => [...(selected?.paymentLinks || [])].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null, [selected]);

  function selectProposal(id: string) {
    setSelectedId(id); setUrl(""); setAmount(""); setReference(""); setMessage(null);
  }

  async function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const externalUrl = (url || link?.external_url || "").trim();
    if (!externalUrl) return setMessage("Introduce la URL HTTPS generada en Teya.");
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/payment-link`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: link?.id || undefined, external_url: externalUrl, amount: Number(amount || link?.amount || selected.total) }),
    });
    const result = await response.json().catch(() => null); setBusy(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo guardar el enlace."));
    const saved = result.data as PaymentLink;
    setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, paymentLinks: [saved, ...proposal.paymentLinks.filter((item) => item.id !== saved.id)] } : proposal));
    setUrl(saved.external_url); setAmount(String(saved.amount)); setMessage("Enlace de Teya guardado correctamente.");
  }

  async function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !link) return;
    if (!reference.trim()) return setMessage("Introduce una referencia única del pago.");
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/payment-links/${link.id}/confirm`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: reference.trim(), amount: Number(amount || link.amount || selected.total), received_at: `${receivedAt}T12:00:00.000Z` }),
    });
    const result = await response.json().catch(() => null); setBusy(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo confirmar el pago."));
    setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, paymentLinks: proposal.paymentLinks.map((item) => item.id === link.id ? { ...item, status: "confirmed", confirmed_at: receivedAt } : item) } : proposal));
    setMessage(result.duplicate ? "El pago ya estaba registrado; no se ha duplicado." : "Pago confirmado. La proforma total y la sincronización con Holded quedan encoladas.");
  }

  return <section className="client-layout">
    <div className="client-main card">
      <div className="panel-head"><div><h2>Presupuestos aceptados</h2><p>Selecciona un presupuesto para añadir su enlace externo de Teya.</p></div><span className="badge">{proposals.length}</span></div>
      {proposals.length ? <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Cliente</th><th>Destino</th><th>Total</th><th>Pago</th></tr></thead><tbody>{proposals.map((proposal) => {
        const latest = [...proposal.paymentLinks].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
        return <tr key={proposal.id} className={proposal.id === selectedId ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => selectProposal(proposal.id)}><strong>{proposal.caseCode}</strong></button></td><td>{proposal.clientName}</td><td>{proposal.destination || "—"}</td><td>{money(proposal.total, proposal.currency)}</td><td>{latest?.status === "confirmed" ? "Confirmado" : latest ? "Enlace creado" : "Pendiente"}</td></tr>;
      })}</tbody></table></div> : <div className="empty-state"><h2>No hay presupuestos aceptados</h2><p>Acepta primero una propuesta para habilitar su enlace de pago.</p></div>}
    </div>
    <aside className="client-side card">{selected ? <><div className="client-side-header compact"><div><h2>{selected.caseCode}</h2><p>{selected.clientName}<br />{selected.destination}</p></div><span className={`status-pill ${link?.status === "confirmed" ? "status-success" : "status-warning"}`}>{link?.status === "confirmed" ? "Pagado" : "Pendiente"}</span></div>
      <section className="side-section"><h3>Enlace Teya</h3><form className="form" onSubmit={saveLink}><label>URL HTTPS<input className="input" type="url" required value={url || link?.external_url || ""} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label><label>Importe<input className="input" type="number" min="0.01" step="0.01" value={amount || String(link?.amount || selected.total)} onChange={(event) => setAmount(event.target.value)} /></label><button className="btn" type="submit" disabled={busy}>{busy ? "Guardando..." : link ? "Actualizar enlace" : "Guardar enlace"}</button></form>{link ? <a className="btn secondary" style={{ marginTop: 12 }} href={link.external_url} target="_blank" rel="noreferrer">Abrir enlace de Teya</a> : null}</section>
      {link && link.status !== "confirmed" ? <section className="side-section"><h3>Confirmación manual</h3><form className="form" onSubmit={confirmPayment}><label>Referencia única<input className="input" required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. TEYA-2026-0001" /></label><label>Fecha de cobro<input className="input" type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></label><button className="btn" type="submit" disabled={busy}>{busy ? "Confirmando..." : "Marcar como pagado"}</button><small>La confirmación crea la proforma por el total del viaje y encola el pago en Holded.</small></form></section> : null}
      {link?.status === "confirmed" ? <section className="side-section"><p className="client-message">Pago confirmado {link.confirmed_at ? `el ${new Date(link.confirmed_at).toLocaleDateString("es-ES")}` : ""}.</p></section> : null}
      {message ? <p className="client-message" role="status">{message}</p> : null}
    </> : <div className="empty-state"><h2>Selecciona un presupuesto</h2></div>}</aside>
  </section>;
}
