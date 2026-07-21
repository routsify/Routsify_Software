"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CaseRow, ContractRow, FiscalRow, PaymentRow } from "./workspace-types";
import { formatDateTime, money, numberValue } from "./workspace-types";

const emptyContract = { title: "Contrato de viaje", status: "draft", external_url: "", notes: "", signer_name: "", signer_email: "" };
const emptyPayment = { amount: "", reference: "", method: "transfer", receivedAt: "", notes: "" };
const contractLabels: Record<string, string> = { draft: "Borrador", sent: "Enviado", signed: "Firmado", cancelled: "Cancelado" };
const paymentLabels: Record<string, string> = { confirmed: "Confirmado", paid: "Pagado", received: "Recibido", pending: "Pendiente" };

export function ContractPaymentsTab({ caseRow, initialContracts = [], initialPayments = [], initialFiscal = [], mode = "all", onContractsChange, onPaymentsChange, onFiscalChange }: {
  caseRow: CaseRow;
  initialContracts?: ContractRow[];
  initialPayments?: PaymentRow[];
  initialFiscal?: FiscalRow[];
  mode?: "all" | "contracts" | "payments";
  onContractsChange?: (contracts: ContractRow[]) => void;
  onPaymentsChange?: (payments: PaymentRow[]) => void;
  onFiscalChange?: (documents: FiscalRow[]) => void;
}) {
  const [contracts, setContracts] = useState(initialContracts);
  const [payments, setPayments] = useState(initialPayments);
  const [fiscal, setFiscal] = useState(initialFiscal);
  const defaultContract = { ...emptyContract, signer_name: caseRow.clients?.display_name || "", signer_email: caseRow.clients?.email || "" };
  const [contractDraft, setContractDraft] = useState(defaultContract);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState(emptyPayment);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const acceptedValue = numberValue(caseRow.accepted_value);
  const paid = useMemo(() => payments.filter((item) => ["confirmed", "paid", "received"].includes(String(item.status))).reduce((sum, item) => sum + numberValue(item.amount), 0), [payments]);
  const pending = Math.max(acceptedValue - paid, 0);
  const signedContract = contracts.some((item) => item.status === "signed");

  useEffect(() => { setContracts(initialContracts); }, [initialContracts]);
  useEffect(() => { setPayments(initialPayments); }, [initialPayments]);
  useEffect(() => { setFiscal(initialFiscal); }, [initialFiscal]);

  function startEdit(item: ContractRow) {
    setEditingContractId(item.id);
    setContractDraft({ title: item.title || "Contrato de viaje", status: item.status || "draft", external_url: item.external_url || "", notes: item.notes || "", signer_name: caseRow.clients?.display_name || "", signer_email: caseRow.clients?.email || "" });
    setMessage(null);
  }

  async function saveContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contractDraft.title.trim()) return setMessage("Indica el título del contrato.");
    if (["sent", "signed"].includes(contractDraft.status) && !contractDraft.external_url.trim()) return setMessage("Añade el enlace al contrato antes de enviarlo o registrar su firma.");
    if (contractDraft.status === "signed" && !contractDraft.signer_name.trim()) return setMessage("Indica quién ha firmado el contrato.");
    if (contractDraft.status === "signed" && !window.confirm(`¿Confirmas que ${contractDraft.signer_name.trim()} ha firmado el contrato revisado? Se guardará evidencia inmutable de esta confirmación.`)) return;
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(caseRow.id)}/contracts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: editingContractId || undefined, ...contractDraft, title: contractDraft.title.trim(), external_url: contractDraft.external_url.trim() || undefined, signer_name: contractDraft.signer_name.trim() || undefined, signer_email: contractDraft.signer_email.trim() || undefined, review_confirmed: contractDraft.status === "signed" }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo guardar el contrato."));
    const updated = result.data as ContractRow;
    setContracts((current) => { const next = editingContractId ? current.map((item) => item.id === editingContractId ? updated : item) : [updated, ...current]; onContractsChange?.(next); return next; });
    setEditingContractId(null); setContractDraft(defaultContract);
    setMessage(updated.status === "signed" ? "Contrato firmado y expediente actualizado." : "Contrato guardado correctamente.");
  }

  async function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(paymentDraft.amount);
    if (acceptedValue <= 0) return setMessage("El presupuesto debe estar aceptado antes de registrar pagos.");
    if (!signedContract) return setMessage("Firma el contrato antes de confirmar el pago.");
    if (!Number.isFinite(amount) || amount <= 0) return setMessage("Introduce un importe de pago válido.");
    if (!paymentDraft.reference.trim()) return setMessage("La referencia del pago es obligatoria.");
    if (!window.confirm(`¿Confirmas el cobro de ${money(amount, caseRow.currency || "EUR")}?`)) return;
    setSaving(true); setMessage(null);
    const response = await fetch("/api/payments/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId: caseRow.id, amount, reference: paymentDraft.reference.trim(), method: paymentDraft.method, receivedAt: paymentDraft.receivedAt || undefined, notes: paymentDraft.notes.trim() || undefined, currency: caseRow.currency || "EUR" }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo confirmar el pago."));
    const rawPayment = result.data;
    const payment = rawPayment && typeof rawPayment === "object" && !Array.isArray(rawPayment) ? rawPayment as PaymentRow : null;
    if (payment?.id) setPayments((current) => { const next = [payment, ...current.filter((item) => item.id !== payment.id)]; onPaymentsChange?.(next); return next; });
    const document = result.proforma?.document as FiscalRow | undefined;
    if (document?.id) setFiscal((current) => { const next = [document, ...current.filter((item) => item.id !== document.id)]; onFiscalChange?.(next); return next; });
    setPaymentDraft(emptyPayment);
    setMessage(result.proforma?.outbox?.ok === false ? "Pago confirmado. La proforma queda preparada, pendiente de configurar Holded." : "Pago confirmado y proforma preparada.");
  }

  return <section className="workspace-grid">
    {mode !== "payments" ? <>
    <div className="card">
      <div className="panel-head"><div><h2>{editingContractId ? "Editar contrato" : "Crear contrato"}</h2><p>Al enviarlo se fija una versión; al firmarlo se conserva la evidencia.</p></div>{editingContractId ? <button className="link-button" type="button" onClick={() => { setEditingContractId(null); setContractDraft(defaultContract); }}>Cancelar edición</button> : null}</div>
      <form className="form" onSubmit={saveContract}>
        <label>Título<input className="input" required value={contractDraft.title} onChange={(event) => setContractDraft((current) => ({ ...current, title: event.target.value }))} /></label>
        <label>Estado<select value={contractDraft.status} onChange={(event) => setContractDraft((current) => ({ ...current, status: event.target.value }))}><option value="draft">Borrador</option><option value="sent">Enviado</option><option value="signed">Firmado</option><option value="cancelled">Cancelado</option></select></label>
        <label>Enlace al contrato{["sent", "signed"].includes(contractDraft.status) ? " *" : ""}<input className="input" type="url" required={["sent", "signed"].includes(contractDraft.status)} placeholder="https://..." value={contractDraft.external_url} onChange={(event) => setContractDraft((current) => ({ ...current, external_url: event.target.value }))} /></label>
        {contractDraft.status === "signed" ? <div className="grid grid-2"><label>Firmante *<input className="input" required value={contractDraft.signer_name} onChange={(event) => setContractDraft((current) => ({ ...current, signer_name: event.target.value }))} /></label><label>Email del firmante<input className="input" type="email" value={contractDraft.signer_email} onChange={(event) => setContractDraft((current) => ({ ...current, signer_email: event.target.value }))} /></label></div> : null}
        <label>Notas<textarea className="input" rows={3} value={contractDraft.notes} onChange={(event) => setContractDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
        <button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : contractDraft.status === "signed" ? "Registrar firma" : editingContractId ? "Guardar cambios" : "Crear contrato"}</button>
      </form>
      {message ? <p className="client-message" role="status">{message}</p> : null}
    </div>

    <div className="card workspace-wide">
      <h2>Contratos</h2>
      {contracts.length ? <div className="table-scroll"><table><thead><tr><th>Contrato</th><th>Estado</th><th>Firma</th><th>Enlace</th><th></th></tr></thead><tbody>{contracts.map((item) => <tr key={item.id}><td><strong>{item.title || "Contrato"}</strong><br/><small>{item.notes || "Sin notas"}</small></td><td><span className={`status-pill ${item.status === "signed" ? "status-success" : item.status === "cancelled" ? "status-danger" : "status-warning"}`}>{contractLabels[item.status || "draft"] || item.status}</span></td><td>{formatDateTime(item.signed_at)}</td><td>{item.external_url ? <a href={item.external_url} target="_blank" rel="noreferrer">Abrir</a> : "—"}</td><td>{item.status === "signed" ? "—" : <button className="link-button" type="button" onClick={() => startEdit(item)}>Editar</button>}</td></tr>)}</tbody></table></div> : <p>No hay contratos registrados.</p>}
    </div>
    </> : null}

    {mode !== "contracts" ? <>
    <div className="card">
      <h2>Confirmar pago manual</h2>
      <div className="payment-summary"><div><span>Viaje aceptado</span><strong>{money(acceptedValue, caseRow.currency || "EUR")}</strong></div><div><span>Cobrado</span><strong>{money(paid, caseRow.currency || "EUR")}</strong></div><div><span>Pendiente</span><strong>{money(pending, caseRow.currency || "EUR")}</strong></div></div>
      <form className="form" onSubmit={confirmPayment}>
        <div className="grid grid-2"><label>Importe *<input className="input" type="number" min="0.01" max={pending || undefined} step="0.01" required value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} /></label><label>Referencia única *<input className="input" required value={paymentDraft.reference} onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))} /></label></div>
        <div className="grid grid-2"><label>Método<select value={paymentDraft.method} onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value }))}><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="cash">Efectivo</option><option value="teya_manual">Teya manual</option><option value="other">Otro</option></select></label><label>Fecha y hora<input className="input" type="datetime-local" value={paymentDraft.receivedAt} onChange={(event) => setPaymentDraft((current) => ({ ...current, receivedAt: event.target.value }))} /></label></div>
        <label>Notas<textarea className="input" rows={2} value={paymentDraft.notes} onChange={(event) => setPaymentDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
        {!signedContract ? <p className="form-warning">El contrato debe estar firmado antes de registrar el pago.</p> : null}
        <button className="btn" type="submit" disabled={saving || !signedContract || acceptedValue <= 0 || pending <= 0}>{saving ? "Confirmando..." : pending <= 0 ? "Pago completo" : "Confirmar pago"}</button>
      </form>
    </div>

    <div className="card workspace-wide">
      <h2>Pagos y documentos fiscales</h2>
      {payments.length ? <div className="table-scroll"><table><thead><tr><th>Referencia</th><th>Importe</th><th>Método</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{payments.map((item) => <tr key={item.id}><td>{item.payment_reference || "—"}</td><td>{money(item.amount, item.currency || caseRow.currency || "EUR")}</td><td>{item.method || "—"}</td><td>{paymentLabels[item.status || "pending"] || item.status}</td><td>{formatDateTime(item.confirmed_at)}</td></tr>)}</tbody></table></div> : <p>No hay pagos confirmados.</p>}
      <h3>Documentos fiscales</h3>
      {fiscal.length ? <div className="table-scroll"><table><thead><tr><th>Documento</th><th>Estado</th><th>Importe</th><th>Emisión</th></tr></thead><tbody>{fiscal.map((item) => <tr key={item.id}><td>{item.document_kind || (item as { document_type?: string }).document_type || "Documento"} {item.document_number || ""}</td><td>{item.status || "—"}</td><td>{money(item.amount, item.currency || caseRow.currency || "EUR")}</td><td>{formatDateTime(item.issued_at)}</td></tr>)}</tbody></table></div> : <p>La proforma se prepara con el primer pago. La factura final requiere viaje finalizado, cinco días de espera y compras completas.</p>}
      {message ? <p className="client-message" role="status">{message}</p> : null}
    </div>
    </> : null}
  </section>;
}
