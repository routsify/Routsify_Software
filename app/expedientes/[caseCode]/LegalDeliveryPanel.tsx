"use client";

import { useState } from "react";
import { usePermission } from "@/components/PermissionProvider";
import type { CaseRow, ContractRow, LegalDocumentRow, TimelineRow } from "./workspace-types";

function relation(value: ContractRow["legal_documents"]) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export function LegalDeliveryPanel({ caseRow, contracts, legalDocuments, signed, fullyPaid, sent, onSent }: { caseRow: CaseRow; contracts: ContractRow[]; legalDocuments: LegalDocumentRow[]; signed: boolean; fullyPaid: boolean; sent: boolean; onSent: (event: TimelineRow) => void }) {
  const canManage = usePermission("cases.manage");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const signedContract = contracts.find((item) => item.status === "signed") || null;
  const linkedDocument = relation(signedContract?.legal_documents) || legalDocuments.find((item) => item.id === signedContract?.legal_document_id) || null;
  const supportingDocuments = legalDocuments.filter((item) => item.document_type !== "travel_contract" && item.status === "ready" && item.is_active);
  const configured = Boolean(signedContract?.legal_document_id && linkedDocument);

  async function sendLegalPack() {
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(caseRow.id)}/legal-delivery`, { method: "POST" });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !result?.ok) {
      const labels: Record<string, string> = {
        signed_contract_required: "Firma primero el contrato.",
        full_payment_required: "Confirma el pago completo antes de enviar el paquete legal.",
        contract_legal_pdf_required: "El contrato firmado no tiene un PDF legal vinculado.",
        contract_legal_pdf_not_found: "No se encuentra el PDF vinculado al contrato.",
        client_email_required: "Añade un email válido a la ficha del cliente.",
        legal_pack_too_large: "Los PDFs superan 20 MB en conjunto. Reduce su tamaño antes de enviarlos.",
      };
      return setMessage(labels[String(result?.error)] || String(result?.error || "No se pudo enviar la documentación."));
    }
    onSent(result.data as TimelineRow);
    setMessage(result.duplicate ? "El envío ya constaba registrado." : `${result.attachments || 0} PDFs enviados por email y registrados en el timeline.`);
  }

  return <section className="workspace-grid">
    <div className="card"><div className="panel-head"><div><h2>PDFs legales</h2><p>Versión contractual bloqueada y documentación complementaria vigente.</p></div><span className={`status-pill ${configured ? "status-success" : "status-warning"}`}>{configured ? "Preparados" : "Incompletos"}</span></div><div className="legal-template-list">{linkedDocument ? <a className="configured" href={`/api/routsify/legal-documents/${encodeURIComponent(linkedDocument.id)}/file`} target="_blank" rel="noreferrer"><span>{linkedDocument.title}</span><strong>{linkedDocument.version_label}</strong></a> : <a className="missing" href="/ajustes?tab=legal"><span>Contrato de viaje</span><strong>Adjuntar PDF</strong></a>}{supportingDocuments.map((document) => <a className="configured" key={document.id} href={`/api/routsify/legal-documents/${encodeURIComponent(document.id)}/file`} target="_blank" rel="noreferrer"><span>{document.title}</span><strong>{document.version_label}</strong></a>)}</div><a className="btn secondary" href="/ajustes?tab=legal">Gestionar PDFs legales</a></div>
    <div className="card"><div className="panel-head"><div><h2>Entrega al cliente</h2><p>Después de firma y pago, envía los PDFs por email y deja evidencia automática.</p></div><span className={`status-pill ${sent ? "status-success" : "status-warning"}`}>{sent ? "Enviado" : "Pendiente"}</span></div><ul className="legal-checklist"><li className={signed ? "done" : ""}>Contrato firmado</li><li className={fullyPaid ? "done" : ""}>Pago completo registrado</li><li className={configured ? "done" : ""}>PDF contractual vinculado</li></ul><div className="form-actions">{canManage ? <button className="btn" type="button" disabled={busy || sent || !signed || !fullyPaid || !configured || !caseRow.clients?.email} onClick={() => void sendLegalPack()}>{busy ? "Enviando…" : sent ? "Documentación enviada" : "Enviar documentación legal"}</button> : null}</div><small>El correo adjunta la versión bloqueada del contrato y los PDFs complementarios incluidos al crearla.</small>{message ? <p className="client-message" role="status">{message}</p> : null}</div>
  </section>;
}
