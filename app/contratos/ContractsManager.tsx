"use client";

import { FormEvent, useMemo, useState } from "react";
import { cases } from "@/lib/mock-data";
import { contractStatuses, contractSummary, demoContracts, formatContractMoney, ContractItem } from "@/lib/contracts";
import { canSendContract, canSignContract, contractBlockers, contractNextAction } from "@/lib/contract-rules";
import { demoTravelers, travelerSummary } from "@/lib/travelers";
import { isDemoMode } from "@/lib/supabase-browser";

type ContractDraft = {
  case_code: string;
  proposal_version: string;
  amount: string;
  document_file: string;
  travelers_ready: boolean;
  payment_required_before_signature: boolean;
  signer_name: string;
  signature_reference: string;
  notes: string;
};

const emptyDraft: ContractDraft = {
  case_code: "EXP-2026-0001",
  proposal_version: "v1",
  amount: "0",
  document_file: "",
  travelers_ready: false,
  payment_required_before_signature: false,
  signer_name: "",
  signature_reference: "",
  notes: "",
};

function clientForCase(caseCode: string) {
  return cases.find((item) => item.case_code === caseCode)?.client ?? "Cliente demo";
}

function caseForCode(caseCode: string) {
  return cases.find((item) => item.case_code === caseCode);
}

function travelerStatsForCase(caseCode: string) {
  return travelerSummary(demoTravelers.filter((item) => item.case_code === caseCode));
}

export function ContractsManager() {
  const [items, setItems] = useState<ContractItem[]>(demoContracts);
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => contractSummary(items), [items]);

  function updateDraft<K extends keyof ContractDraft>(key: K, value: ContractDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const caseData = caseForCode(draft.case_code);
    const stats = travelerStatsForCase(draft.case_code);
    const base: ContractItem = {
      id: `contract-${Date.now()}`,
      case_code: draft.case_code,
      client: clientForCase(draft.case_code),
      proposal_version: draft.proposal_version.trim() || "v1",
      status: "draft",
      amount: Number(draft.amount) || caseData?.accepted_value || 0,
      currency: "EUR",
      travelers_ready: draft.travelers_ready || stats.ready,
      payment_required_before_signature: draft.payment_required_before_signature,
      document_file: draft.document_file.trim() || undefined,
      signer_name: draft.signer_name.trim() || undefined,
      signature_reference: draft.signature_reference.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    };
    const blockers = contractBlockers(base, caseData, stats);
    const item: ContractItem = blockers.length ? { ...base, status: "blocked", blocker: blockers.join(" · ") } : base;

    setItems((current) => [item, ...current]);
    setDraft({ ...emptyDraft, case_code: draft.case_code });
    setMessage(isDemoMode() ? "Contrato preparado en modo demo con validación de propuesta y viajeros." : "Contrato creado.");
  }

  function updateStatus(id: string, status: ContractItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status, sent_at: status === "sent" ? new Date().toISOString().slice(0, 10) : item.sent_at, signed_at: status === "signed" ? new Date().toISOString().slice(0, 10) : item.signed_at } : item));
  }

  function prepareToSend(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const caseData = caseForCode(current.case_code);
    const stats = travelerStatsForCase(current.case_code);
    const blockers = contractBlockers(current, caseData, stats);
    if (blockers.length > 0) {
      setItems((list) => list.map((item) => item.id === id ? { ...item, status: "blocked", blocker: blockers.join(" · ") } : item));
      setMessage("Contrato bloqueado: " + blockers.join(" · "));
      return;
    }
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "sent", sent_at: new Date().toISOString().slice(0, 10), blocker: undefined } : item));
    setMessage("Contrato marcado como enviado. La firma se controla manualmente en el MVP.");
  }

  function markSigned(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const caseData = caseForCode(current.case_code);
    const stats = travelerStatsForCase(current.case_code);
    if (!canSignContract(current, caseData, stats)) {
      setItems((list) => list.map((item) => item.id === id ? { ...item, status: "blocked", blocker: contractBlockers(item, caseData, stats).join(" · ") || "No está listo para firma." } : item));
      setMessage("No se puede marcar firmado hasta resolver bloqueos.");
      return;
    }
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "signed", signed_at: new Date().toISOString().slice(0, 10), signature_reference: item.signature_reference || `SIGN-${Date.now()}`, blocker: undefined } : item));
    setMessage("Contrato firmado en modo demo. Ya puede avanzar a pagos, compras y cierre.");
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Contratos</span><div className="metric">{summary.total}</div><p>Contratos asociados a propuestas aceptadas.</p></div>
        <div className="card"><span className="badge">Bloqueados</span><div className="metric">{summary.blocked}</div><p>Por propuesta, documentación o archivo.</p></div>
        <div className="card"><span className="badge">Pendientes firma</span><div className="metric">{summary.awaitingSignature}</div><p>{summary.signed} firmados.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Nuevo contrato</div>
          <h2>Preparar contrato desde propuesta</h2>
          <form className="form" onSubmit={addContract}>
            <label>Expediente<select value={draft.case_code} onChange={(event) => updateDraft("case_code", event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select></label>
            <div className="grid grid-2"><label>Versión propuesta<input className="input" value={draft.proposal_version} onChange={(event) => updateDraft("proposal_version", event.target.value)} /></label><label>Importe<input className="input" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => updateDraft("amount", event.target.value)} placeholder="Usa valor aceptado si queda vacío" /></label></div>
            <label>Archivo contrato<input className="input" value={draft.document_file} onChange={(event) => updateDraft("document_file", event.target.value)} placeholder="contrato.pdf" /></label>
            <div className="grid grid-2"><label>Firmante<input className="input" value={draft.signer_name} onChange={(event) => updateDraft("signer_name", event.target.value)} /></label><label>Referencia firma<input className="input" value={draft.signature_reference} onChange={(event) => updateDraft("signature_reference", event.target.value)} /></label></div>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={draft.travelers_ready} onChange={(event) => updateDraft("travelers_ready", event.target.checked)} />Forzar viajeros revisados</label>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={draft.payment_required_before_signature} onChange={(event) => updateDraft("payment_required_before_signature", event.target.checked)} />Pago requerido antes de firma</label>
            <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Crear contrato</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Regla operativa</div>
          <h2>No firmar sin base documental</h2>
          <p>El contrato se valida contra propuesta aceptada, documentación mínima de viajeros, importe y archivo. Si algo falla queda bloqueado y genera siguiente acción.</p>
          <table><tbody><tr><th>Fuente</th><td>Propuesta aceptada</td></tr><tr><th>Bloqueo crítico</th><td>Viajeros, propuesta o archivo</td></tr><tr><th>Después</th><td>Pago, proveedores y cierre</td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Expediente</th><th>Cliente</th><th>Propuesta</th><th>Importe</th><th>Estado</th><th>Fechas</th><th>Reglas</th><th>Acción</th></tr></thead>
          <tbody>{items.map((item) => { const caseData = caseForCode(item.case_code); const stats = travelerStatsForCase(item.case_code); const blockers = contractBlockers(item, caseData, stats); return <tr key={item.id}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td>{item.client}</td><td>{item.proposal_version}</td><td>{formatContractMoney(item.amount, item.currency)}</td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as ContractItem["status"])}>{contractStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{item.sent_at || "sin envío"}<br/><small>{item.signed_at || "sin firma"}</small></td><td>{blockers.length ? blockers.join(" · ") : "Validado"}<br/><small>{contractNextAction(item, caseData, stats)}</small></td><td><button className="btn secondary" type="button" onClick={() => prepareToSend(item.id)} disabled={!canSendContract(item, caseData, stats)}>Enviar</button><br/><button className="btn secondary" type="button" onClick={() => markSigned(item.id)} style={{ marginTop: 8 }}>Firmar</button></td></tr>; })}</tbody>
        </table>
      </section>
    </div>
  );
}
