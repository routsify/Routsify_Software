"use client";

import { FormEvent, useMemo, useState } from "react";
import { cases } from "@/lib/mock-data";
import { contractStatuses, contractSummary, demoContracts, formatContractMoney, ContractItem } from "@/lib/contracts";
import { isDemoMode } from "@/lib/supabase-browser";

type ContractDraft = {
  case_code: string;
  proposal_version: string;
  amount: string;
  document_file: string;
  travelers_ready: boolean;
  notes: string;
};

const emptyDraft: ContractDraft = {
  case_code: "EXP-2026-0001",
  proposal_version: "v1",
  amount: "0",
  document_file: "",
  travelers_ready: false,
  notes: "",
};

function clientForCase(caseCode: string) {
  return cases.find((item) => item.case_code === caseCode)?.client ?? "Cliente demo";
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
    const item: ContractItem = {
      id: `contract-${Date.now()}`,
      case_code: draft.case_code,
      client: clientForCase(draft.case_code),
      proposal_version: draft.proposal_version.trim() || "v1",
      status: draft.travelers_ready ? "draft" : "blocked",
      amount: Number(draft.amount) || 0,
      currency: "EUR",
      travelers_ready: draft.travelers_ready,
      payment_required_before_signature: false,
      document_file: draft.document_file.trim() || undefined,
      blocker: draft.travelers_ready ? undefined : "Falta documentación mínima de viajeros.",
      notes: draft.notes.trim() || undefined,
    };

    setItems((current) => [item, ...current]);
    setDraft({ ...emptyDraft, case_code: draft.case_code });
    setMessage(isDemoMode() ? "Contrato creado en modo demo. La gestión real se activará con Supabase." : "Contrato creado.");
  }

  function updateStatus(id: string, status: ContractItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status, signed_at: status === "signed" ? new Date().toISOString().slice(0, 10) : item.signed_at } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Contratos</span><div className="metric">{summary.total}</div><p>Contratos asociados a propuestas aceptadas.</p></div>
        <div className="card"><span className="badge">Bloqueados</span><div className="metric">{summary.blocked}</div><p>Normalmente por documentación incompleta.</p></div>
        <div className="card"><span className="badge">Firmados</span><div className="metric">{summary.signed}</div><p>Listos para avanzar a pago y operación final.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Nuevo contrato</div>
          <h2>Preparar contrato desde propuesta</h2>
          <form className="form" onSubmit={addContract}>
            <label>Expediente<select value={draft.case_code} onChange={(event) => updateDraft("case_code", event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select></label>
            <div className="grid grid-2">
              <label>Versión propuesta<input className="input" value={draft.proposal_version} onChange={(event) => updateDraft("proposal_version", event.target.value)} /></label>
              <label>Importe<input className="input" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => updateDraft("amount", event.target.value)} /></label>
            </div>
            <label>Archivo<input className="input" value={draft.document_file} onChange={(event) => updateDraft("document_file", event.target.value)} placeholder="contrato.pdf" /></label>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={draft.travelers_ready} onChange={(event) => updateDraft("travelers_ready", event.target.checked)} />Viajeros revisados</label>
            <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Crear contrato</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Regla operativa</div>
          <h2>No saltarse documentación</h2>
          <p>El contrato depende de una propuesta aceptada y de documentación mínima. En el MVP se registra el estado y el archivo de forma manual.</p>
          <table><tbody><tr><th>Fuente</th><td>Propuesta aceptada</td></tr><tr><th>Bloqueo crítico</th><td>Documentación incompleta</td></tr><tr><th>Después</th><td>Pago, proveedores y cierre</td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Expediente</th><th>Cliente</th><th>Propuesta</th><th>Importe</th><th>Estado</th><th>Archivo</th><th>Notas</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.case_code}</strong></td><td>{item.client}</td><td>{item.proposal_version}</td><td>{formatContractMoney(item.amount, item.currency)}</td><td><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as ContractItem["status"])}>{contractStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><br/><small>{item.signed_at || "sin firma"}</small></td><td>{item.document_file || "—"}</td><td>{item.blocker || item.notes || "—"}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
