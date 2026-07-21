"use client";

import { useMemo, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";
import type { CaseRow, LegalTemplates, TimelineRow } from "./workspace-types";

export function LegalDeliveryPanel({ caseRow, templates, signed, fullyPaid, sent, onSent }: { caseRow: CaseRow; templates: LegalTemplates; signed: boolean; fullyPaid: boolean; sent: boolean; onSent: (event: TimelineRow) => void }) {
  const canManage = usePermission("cases.manage");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configured = Boolean(templates.generalConditionsUrl && templates.standardInformationUrl);
  const mailto = useMemo(() => {
    const email = caseRow.clients?.email || "";
    const subject = `Documentación de tu viaje · ${caseRow.case_code}`;
    const body = [
      `Hola ${caseRow.clients?.display_name || ""},`,
      "",
      `Te enviamos la documentación legal correspondiente a tu viaje ${caseRow.destination ? `a ${caseRow.destination}` : ""}:`,
      templates.generalConditionsUrl ? `• Condiciones generales: ${templates.generalConditionsUrl}` : "",
      templates.standardInformationUrl ? `• Formulario de información normalizada: ${templates.standardInformationUrl}` : "",
      "",
      "Adjuntamos también el contrato firmado y la documentación fiscal correspondiente.",
      "",
      "Un saludo,",
      "Equipo Routsify",
    ].filter((line) => line !== "").join("\n");
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [caseRow, templates]);

  async function markSent() {
    setBusy(true); setMessage(null);
    const response = await fetch(`/api/routsify/cases/${encodeURIComponent(caseRow.id)}/legal-delivery`, { method: "POST" });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !result?.ok) {
      const labels: Record<string, string> = { signed_contract_required: "Firma primero el contrato.", full_payment_required: "Confirma el pago completo antes de enviar el paquete legal.", legal_templates_incomplete: "Completa las plantillas legales en Ajustes." };
      return setMessage(labels[String(result?.error)] || String(result?.error || "No se pudo registrar el envío."));
    }
    onSent(result.data as TimelineRow);
    setMessage(result.duplicate ? "El envío ya constaba registrado." : "Envío legal registrado en el timeline.");
  }

  return <section className="workspace-grid">
    <div className="card"><div className="panel-head"><div><h2>Plantillas legales</h2><p>Documentos vigentes configurados para todos los expedientes.</p></div><span className={`status-pill ${configured ? "status-success" : "status-warning"}`}>{configured ? "Completas" : "Incompletas"}</span></div><div className="legal-template-list"><a className={templates.contractTemplateUrl ? "configured" : "missing"} href={templates.contractTemplateUrl || "/ajustes"} target={templates.contractTemplateUrl ? "_blank" : undefined} rel="noreferrer"><span>Plantilla de contrato</span><strong>{templates.contractTemplateUrl ? "Abrir" : "Configurar"}</strong></a><a className={templates.generalConditionsUrl ? "configured" : "missing"} href={templates.generalConditionsUrl || "/ajustes"} target={templates.generalConditionsUrl ? "_blank" : undefined} rel="noreferrer"><span>Condiciones generales</span><strong>{templates.generalConditionsUrl ? "Abrir" : "Configurar"}</strong></a><a className={templates.standardInformationUrl ? "configured" : "missing"} href={templates.standardInformationUrl || "/ajustes"} target={templates.standardInformationUrl ? "_blank" : undefined} rel="noreferrer"><span>Información normalizada</span><strong>{templates.standardInformationUrl ? "Abrir" : "Configurar"}</strong></a></div><a className="btn secondary" href="/ajustes">Gestionar plantillas legales</a></div>
    <div className="card"><div className="panel-head"><div><h2>Entrega al cliente</h2><p>Después de firma y pago, prepara el email y deja constancia del envío.</p></div><span className={`status-pill ${sent ? "status-success" : "status-warning"}`}>{sent ? "Enviado" : "Pendiente"}</span></div><ul className="legal-checklist"><li className={signed ? "done" : ""}>Contrato firmado</li><li className={fullyPaid ? "done" : ""}>Pago completo registrado</li><li className={configured ? "done" : ""}>Plantillas legales completas</li></ul><div className="form-actions"><a className="btn" aria-disabled={!signed || !fullyPaid || !configured || !caseRow.clients?.email} href={signed && fullyPaid && configured && caseRow.clients?.email ? mailto : undefined}>Preparar email</a>{canManage ? <button className="btn secondary" type="button" disabled={busy || sent || !signed || !fullyPaid || !configured} onClick={() => void markSent()}>{busy ? "Registrando…" : sent ? "Envío registrado" : "Marcar como enviado"}</button> : null}</div><small>Antes de enviarlo, adjunta el contrato firmado y el documento fiscal generado.</small>{message ? <p className="client-message" role="status">{message}</p> : null}</div>
  </section>;
}
