"use client";

import { useState } from "react";
import { usePermission } from "@/components/PermissionProvider";
import type { CaseRow, LegalTemplates, TimelineRow } from "./workspace-types";

export function LegalDeliveryPanel({ caseRow, templates, signed, fullyPaid, sent, onSent }: { caseRow: CaseRow; templates: LegalTemplates; signed: boolean; fullyPaid: boolean; sent: boolean; onSent: (event: TimelineRow) => void }) {
  const canManage = usePermission("cases.manage");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configured = Boolean(templates.generalConditionsUrl && templates.standardInformationUrl);

  async function sendLegalPack() {
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(caseRow.id)}/legal-delivery`, { method: "POST" });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !result?.ok) {
      const labels: Record<string, string> = { signed_contract_required: "Firma primero el contrato.", full_payment_required: "Confirma el pago completo antes de enviar el paquete legal.", legal_templates_incomplete: "Completa las plantillas legales en Ajustes.", client_email_required: "Añade un email válido a la ficha del cliente.", contract_delivery_link_required: "Añade al contrato firmado su enlace privado de entrega." };
      return setMessage(labels[String(result?.error)] || String(result?.error || "No se pudo enviar la documentación."));
    }
    onSent(result.data as TimelineRow);
    setMessage(result.duplicate ? "El envío ya constaba registrado." : "Documentación enviada por email y registrada en el timeline.");
  }

  return <section className="workspace-grid">
    <div className="card"><div className="panel-head"><div><h2>Plantillas legales</h2><p>Documentos vigentes configurados para todos los expedientes.</p></div><span className={`status-pill ${configured ? "status-success" : "status-warning"}`}>{configured ? "Completas" : "Incompletas"}</span></div><div className="legal-template-list"><a className={templates.contractTemplateUrl ? "configured" : "missing"} href={templates.contractTemplateUrl || "/ajustes"} target={templates.contractTemplateUrl ? "_blank" : undefined} rel="noreferrer"><span>Plantilla de contrato</span><strong>{templates.contractTemplateUrl ? "Abrir" : "Configurar"}</strong></a><a className={templates.generalConditionsUrl ? "configured" : "missing"} href={templates.generalConditionsUrl || "/ajustes"} target={templates.generalConditionsUrl ? "_blank" : undefined} rel="noreferrer"><span>Condiciones generales</span><strong>{templates.generalConditionsUrl ? "Abrir" : "Configurar"}</strong></a><a className={templates.standardInformationUrl ? "configured" : "missing"} href={templates.standardInformationUrl || "/ajustes"} target={templates.standardInformationUrl ? "_blank" : undefined} rel="noreferrer"><span>Información normalizada</span><strong>{templates.standardInformationUrl ? "Abrir" : "Configurar"}</strong></a></div><a className="btn secondary" href="/ajustes">Gestionar plantillas legales</a></div>
    <div className="card"><div className="panel-head"><div><h2>Entrega al cliente</h2><p>Después de firma y pago, envía el paquete legal por email y deja evidencia automática.</p></div><span className={`status-pill ${sent ? "status-success" : "status-warning"}`}>{sent ? "Enviado" : "Pendiente"}</span></div><ul className="legal-checklist"><li className={signed ? "done" : ""}>Contrato firmado</li><li className={fullyPaid ? "done" : ""}>Pago completo registrado</li><li className={configured ? "done" : ""}>Plantillas legales completas</li></ul><div className="form-actions">{canManage ? <button className="btn" type="button" disabled={busy || sent || !signed || !fullyPaid || !configured || !caseRow.clients?.email} onClick={() => void sendLegalPack()}>{busy ? "Enviando…" : sent ? "Documentación enviada" : "Enviar documentación legal"}</button> : null}</div><small>El correo incluye el contrato firmado, las condiciones generales, la información normalizada y la referencia de los documentos fiscales emitidos.</small>{message ? <p className="client-message" role="status">{message}</p> : null}</div>
  </section>;
}
