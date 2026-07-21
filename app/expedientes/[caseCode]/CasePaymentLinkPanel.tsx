"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";
import type { CaseRow, PaymentRow } from "./workspace-types";
import { money, numberValue } from "./workspace-types";

type PaymentLink = { id: string; external_url: string; amount: number | string; currency?: string | null; status?: string | null; confirmed_at?: string | null; created_at?: string | null };

export function CasePaymentLinkPanel({ proposalId, caseRow, onPaymentConfirmed }: { proposalId?: string | null; caseRow: CaseRow; onPaymentConfirmed?: (payment: PaymentRow) => void }) {
  const canManage = usePermission("payment_links.manage");
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [url, setUrl] = useState("");
  const [amount, setAmount] = useState(String(numberValue(caseRow.accepted_value) || ""));
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const link = useMemo(() => [...links].sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))[0] || null, [links]);

  useEffect(() => {
    if (!proposalId) return;
    const controller = new AbortController();
    fetch(`/api/routsify/proposals/${encodeURIComponent(proposalId)}/payment-link`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(String(result?.error || "No se pudo cargar el enlace de pago."));
        setLinks(Array.isArray(result.data) ? result.data : []);
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "No se pudo cargar el enlace de pago."); });
    return () => controller.abort();
  }, [proposalId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposalId || !canManage) return;
    const externalUrl = (url || link?.external_url || "").trim();
    if (!externalUrl.startsWith("https://")) return setMessage("Introduce una URL HTTPS válida de Teya.");
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${encodeURIComponent(proposalId)}/payment-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: link?.id || undefined, external_url: externalUrl, amount: Number(amount || link?.amount || caseRow.accepted_value || 0) }),
    });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo guardar el enlace de pago."));
    const saved = result.data as PaymentLink;
    setLinks((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setUrl(saved.external_url); setAmount(String(saved.amount)); setMessage("Enlace de pago guardado y listo para enviar al cliente.");
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!link || !canManage) return;
    if (!reference.trim()) return setMessage("Introduce la referencia única del cobro.");
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/payment-links/${encodeURIComponent(link.id)}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: reference.trim(), amount: Number(amount || link.amount), received_at: `${receivedAt}T12:00:00.000Z` }),
    });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo confirmar el pago."));
    setLinks((current) => current.map((item) => item.id === link.id ? { ...item, status: "confirmed", confirmed_at: receivedAt } : item));
    const payment = result.data?.payment as PaymentRow | undefined;
    if (payment?.id) onPaymentConfirmed?.(payment);
    setMessage(result.data?.duplicate ? "El pago ya estaba registrado; no se ha duplicado." : "Pago confirmado y registrado. La proforma y Holded quedan encolados.");
  }

  if (!proposalId) return <section className="card"><h2>Enlace de pago</h2><p>Acepta primero un presupuesto para habilitar el cobro.</p></section>;

  return <section className="workspace-grid">
    <div className="card"><div className="panel-head"><div><h2>Enlace de pago Teya</h2><p>Guarda el enlace externo con el importe correspondiente.</p></div><span className={`status-pill ${link?.status === "confirmed" ? "status-success" : link ? "status-warning" : ""}`}>{link?.status === "confirmed" ? "Pagado" : link ? "Preparado" : "Pendiente"}</span></div>{canManage ? <form className="form" onSubmit={save}><label>URL HTTPS<input className="input" type="url" required value={url || link?.external_url || ""} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label><label>Importe<input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button className="btn" type="submit" disabled={busy}>{busy ? "Guardando…" : link ? "Actualizar enlace" : "Guardar enlace"}</button></form> : <p>Tu rol puede consultar el estado, pero no modificar enlaces de pago.</p>}{link ? <div className="form-actions"><a className="btn secondary" href={link.external_url} target="_blank" rel="noreferrer">Abrir enlace</a><button className="btn secondary" type="button" onClick={() => void navigator.clipboard.writeText(link.external_url).then(() => setMessage("Enlace copiado."))}>Copiar</button></div> : null}</div>
    <div className="card"><h2>Registrar cobro</h2><p>Total aceptado: <strong>{money(caseRow.accepted_value, caseRow.currency || "EUR")}</strong></p>{link && link.status !== "confirmed" && canManage ? <form className="form" onSubmit={confirm}><label>Referencia única<input className="input" required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. TEYA-2026-0001" /></label><label>Fecha de cobro<input className="input" type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></label><button className="btn" type="submit" disabled={busy}>{busy ? "Confirmando…" : "Marcar como pagado"}</button></form> : <p>{link?.status === "confirmed" ? "El cobro ya está confirmado." : "Crea primero el enlace de pago."}</p>}{message ? <p className="client-message" role="status">{message}</p> : null}</div>
  </section>;
}
