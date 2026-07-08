"use client";

import { FormEvent, useMemo, useState } from "react";
import { cases } from "@/lib/mock-data";
import {
  billingStatuses,
  billingSummary,
  billingTypes,
  demoBillingDocuments,
  demoPayments,
  formatBillingMoney,
  BillingDocument,
  PaymentItem,
  paymentStatuses,
} from "@/lib/billing";
import { billingCaseSummary, canMarkReady, documentBlockers } from "@/lib/billing-rules";
import { isDemoMode } from "@/lib/supabase-browser";

type FiscalDocument = BillingDocument & {
  contact_ready?: boolean;
  payment_required?: boolean;
  locked?: boolean;
};

type PaymentDraft = {
  case_code: string;
  method: string;
  amount: string;
  received_at: string;
  reference: string;
  notes: string;
};

type DocumentDraft = {
  case_code: string;
  type: BillingDocument["type"];
  amount: string;
  contact_ready: boolean;
  payment_required: boolean;
  sync_message: string;
};

const emptyPaymentDraft: PaymentDraft = {
  case_code: "EXP-2026-0001",
  method: "transferencia_manual",
  amount: "0",
  received_at: "",
  reference: "",
  notes: "",
};

const emptyDocumentDraft: DocumentDraft = {
  case_code: "EXP-2026-0001",
  type: "proforma",
  amount: "0",
  contact_ready: false,
  payment_required: true,
  sync_message: "Preparado para revisión manual antes de enviar a sistema fiscal.",
};

function clientForCase(caseCode: string) {
  return cases.find((item) => item.case_code === caseCode)?.client ?? "Cliente demo";
}

function initialDocs(): FiscalDocument[] {
  return demoBillingDocuments.map((doc) => ({
    ...doc,
    contact_ready: doc.case_code === "EXP-2026-0002",
    payment_required: doc.type !== "proforma",
    locked: doc.status === "synced",
  }));
}

export function BillingManager() {
  const [payments, setPayments] = useState<PaymentItem[]>(demoPayments);
  const [docs, setDocs] = useState<FiscalDocument[]>(initialDocs());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [docDraft, setDocDraft] = useState<DocumentDraft>(emptyDocumentDraft);
  const [message, setMessage] = useState<string | null>(null);

  const summary = useMemo(() => billingSummary(payments, docs), [payments, docs]);
  const casePayment = useMemo(() => billingCaseSummary(payments, docDraft.case_code), [payments, docDraft.case_code]);

  function setPayment<K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) {
    setPaymentDraft((current) => ({ ...current, [key]: value }));
  }

  function setDoc<K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) {
    setDocDraft((current) => ({ ...current, [key]: value }));
  }

  function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item: PaymentItem = {
      id: `payment-${Date.now()}`,
      case_code: paymentDraft.case_code,
      client: clientForCase(paymentDraft.case_code),
      method: paymentDraft.method.trim() || "transferencia_manual",
      amount: Number(paymentDraft.amount) || 0,
      currency: "EUR",
      status: paymentDraft.received_at ? "received" : "pending",
      received_at: paymentDraft.received_at || undefined,
      reference: paymentDraft.reference.trim() || undefined,
      notes: paymentDraft.notes.trim() || undefined,
    };
    setPayments((current) => [item, ...current]);
    setPaymentDraft({ ...emptyPaymentDraft, case_code: paymentDraft.case_code });
    setMessage(isDemoMode() ? "Pago registrado en modo demo. La confirmación real seguirá siendo manual al inicio." : "Pago registrado.");
  }

  function addDoc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item: FiscalDocument = {
      id: `billing-${Date.now()}`,
      case_code: docDraft.case_code,
      client: clientForCase(docDraft.case_code),
      type: docDraft.type,
      amount: Number(docDraft.amount) || 0,
      currency: "EUR",
      status: "draft",
      contact_ready: docDraft.contact_ready,
      payment_required: docDraft.payment_required,
      locked: false,
      sync_message: docDraft.sync_message.trim() || undefined,
    };
    setDocs((current) => [item, ...current]);
    setDocDraft({ ...emptyDocumentDraft, case_code: docDraft.case_code });
    setMessage(isDemoMode() ? "Borrador fiscal creado en modo demo. Antes de enviarlo se comprobarán contacto y pago." : "Documento creado.");
  }

  function prepareDoc(id: string) {
    const doc = docs.find((item) => item.id === id);
    if (!doc) return;
    const blockers = documentBlockers(doc, payments);
    if (blockers.length > 0) {
      setDocs((current) => current.map((item) => item.id === id ? { ...item, status: "blocked", sync_message: blockers.join(" · ") } : item));
      setMessage("Documento bloqueado: " + blockers.join(" · "));
      return;
    }
    setDocs((current) => current.map((item) => item.id === id ? { ...item, status: "ready", sync_message: "Listo para envío manual controlado.", locked: false } : item));
    setMessage("Documento listo tras validar contacto, pago y reglas de negocio.");
  }

  function markSent(id: string) {
    setDocs((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (!canMarkReady(item, payments)) return { ...item, status: "blocked", sync_message: documentBlockers(item, payments).join(" · ") };
      return { ...item, status: "sent", locked: true, sync_message: "Enviado o marcado como enviado. Bloqueado para evitar duplicados." };
    }));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Cobrado</span><div className="metric">{formatBillingMoney(summary.received)}</div><p>Pagos confirmados manualmente.</p></div>
        <div className="card"><span className="badge">Pendiente</span><div className="metric">{formatBillingMoney(summary.pending)}</div><p>Importe pendiente de confirmar.</p></div>
        <div className="card"><span className="badge">Documentos</span><div className="metric">{summary.documentsSynced}/{docs.length}</div><p>{summary.syncErrors} errores y {docs.filter((doc) => documentBlockers(doc, payments).length > 0).length} bloqueados.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Pago manual</div>
          <h2>Registrar cobro</h2>
          <form className="form" onSubmit={addPayment}>
            <label>Expediente<select value={paymentDraft.case_code} onChange={(event) => setPayment("case_code", event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select></label>
            <div className="grid grid-3"><label>Método<input className="input" value={paymentDraft.method} onChange={(event) => setPayment("method", event.target.value)} /></label><label>Importe<input className="input" type="number" min="0" step="0.01" value={paymentDraft.amount} onChange={(event) => setPayment("amount", event.target.value)} /></label><label>Fecha cobro<input className="input" type="date" value={paymentDraft.received_at} onChange={(event) => setPayment("received_at", event.target.value)} /></label></div>
            <label>Referencia<input className="input" value={paymentDraft.reference} onChange={(event) => setPayment("reference", event.target.value)} /></label>
            <label>Notas<textarea className="input" rows={3} value={paymentDraft.notes} onChange={(event) => setPayment("notes", event.target.value)} /></label>
            <button className="btn" type="submit">Registrar pago</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Documento fiscal</div>
          <h2>Preparar documento</h2>
          <form className="form" onSubmit={addDoc}>
            <label>Expediente<select value={docDraft.case_code} onChange={(event) => setDoc("case_code", event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select></label>
            <p>Pagado en expediente: {formatBillingMoney(casePayment.received)} · pendiente: {formatBillingMoney(casePayment.pending)}</p>
            <div className="grid grid-2"><label>Tipo<select value={docDraft.type} onChange={(event) => setDoc("type", event.target.value as BillingDocument["type"])}>{billingTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Importe<input className="input" type="number" min="0" step="0.01" value={docDraft.amount} onChange={(event) => setDoc("amount", event.target.value)} /></label></div>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={docDraft.contact_ready} onChange={(event) => setDoc("contact_ready", event.target.checked)} />Contacto fiscal validado</label>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={docDraft.payment_required} onChange={(event) => setDoc("payment_required", event.target.checked)} />Requiere pago confirmado antes de enviar</label>
            <label>Nota<textarea className="input" rows={4} value={docDraft.sync_message} onChange={(event) => setDoc("sync_message", event.target.value)} /></label>
            <button className="btn" type="submit">Crear borrador fiscal</button>
          </form>
        </div>
      </section>

      {message ? <section className="card"><p>{message}</p></section> : null}

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Pagos</div>
          <table><thead><tr><th>Expediente</th><th>Cliente</th><th>Importe</th><th>Estado</th><th>Referencia</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><a href={`/expedientes/${payment.case_code}`}><strong>{payment.case_code}</strong></a></td><td>{payment.client}</td><td>{formatBillingMoney(payment.amount, payment.currency)}</td><td><select value={payment.status} onChange={(event) => setPayments((current) => current.map((item) => item.id === payment.id ? { ...item, status: event.target.value as PaymentItem["status"] } : item))}>{paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{payment.reference || "—"}<br/><small>{payment.received_at || "sin fecha"}</small></td></tr>)}</tbody></table>
        </div>

        <div className="card">
          <div className="eyebrow">Documentos fiscales</div>
          <table><thead><tr><th>Expediente</th><th>Tipo</th><th>Importe</th><th>Estado</th><th>Reglas</th><th>Acción</th></tr></thead><tbody>{docs.map((doc) => { const blockers = documentBlockers(doc, payments); return <tr key={doc.id}><td><a href={`/expedientes/${doc.case_code}`}><strong>{doc.case_code}</strong></a><br/><small>{doc.client}</small></td><td>{doc.type}</td><td>{formatBillingMoney(doc.amount, doc.currency)}</td><td><select value={doc.status} onChange={(event) => setDocs((current) => current.map((item) => item.id === doc.id ? { ...item, status: event.target.value as BillingDocument["status"] } : item))}>{billingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{blockers.length ? blockers.join(" · ") : "Validado"}<br/><small>{doc.sync_message || "—"}</small></td><td><button className="btn secondary" type="button" onClick={() => prepareDoc(doc.id)}>Validar</button><br/><button className="btn secondary" type="button" onClick={() => markSent(doc.id)} style={{ marginTop: 8 }}>Marcar enviado</button></td></tr>; })}</tbody></table>
        </div>
      </section>
    </div>
  );
}
