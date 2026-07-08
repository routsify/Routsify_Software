export type CloseCheck = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  blocking: boolean;
  area: string;
  href: string;
  evidence: string;
  action: string;
};

export type CloseInputs = {
  proposalAccepted: boolean;
  travelersReady: boolean;
  contractSigned: boolean;
  paymentOutstanding: number;
  supplierPending: number;
  fiscalBlocked: number;
  documentsPending: number;
  finalNotesSaved: boolean;
};

export function buildCloseChecks(input: CloseInputs): CloseCheck[] {
  return [
    {
      id: "proposal_accepted",
      label: "Propuesta aceptada y bloqueada",
      description: "La venta y las condiciones deben quedar fijadas antes de cerrar.",
      done: input.proposalAccepted,
      blocking: true,
      area: "Propuestas",
      href: "/propuestas",
      evidence: input.proposalAccepted ? "Existe valor aceptado o estado de aceptación." : "No consta aceptación bloqueada.",
      action: "Aceptar o bloquear la versión económica vigente.",
    },
    {
      id: "travelers_documented",
      label: "Viajeros documentados",
      description: "No debe cerrarse si faltan datos mínimos o documentos de viajeros.",
      done: input.travelersReady,
      blocking: true,
      area: "Viajeros",
      href: "/viajeros",
      evidence: input.travelersReady ? "Viajeros listos." : "Hay viajeros incompletos, faltantes o caducados.",
      action: "Completar y validar documentación de viajeros.",
    },
    {
      id: "documents_reviewed",
      label: "Documentación operativa revisada",
      description: "Documentos críticos del expediente sin faltantes ni revisión pendiente.",
      done: input.documentsPending === 0,
      blocking: true,
      area: "Documentos",
      href: "/documentos",
      evidence: `${input.documentsPending} documentos pendientes.`,
      action: "Subir, validar o justificar documentos pendientes.",
    },
    {
      id: "contract_signed",
      label: "Contrato firmado",
      description: "Contrato firmado y asociado al expediente.",
      done: input.contractSigned,
      blocking: true,
      area: "Contratos",
      href: "/contratos",
      evidence: input.contractSigned ? "Contrato firmado." : "Contrato sin firma confirmada.",
      action: "Preparar, enviar o marcar firma del contrato.",
    },
    {
      id: "payment_confirmed",
      label: "Pago confirmado",
      description: "La parte pendiente debe estar cobrada o justificada antes del cierre.",
      done: input.paymentOutstanding <= 0,
      blocking: true,
      area: "Pagos",
      href: "/facturacion",
      evidence: `${input.paymentOutstanding.toLocaleString("es-ES")} € pendientes.`,
      action: "Confirmar cobro manual o regularizar el importe pendiente.",
    },
    {
      id: "supplier_invoices_reviewed",
      label: "Facturas proveedor cerradas",
      description: "Todas las compras esperadas deben estar aprobadas, canceladas o justificadas.",
      done: input.supplierPending === 0,
      blocking: true,
      area: "Compras",
      href: "/compras",
      evidence: `${input.supplierPending} compras pendientes.`,
      action: "Aprobar factura, revisar diferencia o justificar como no requerida.",
    },
    {
      id: "fiscal_documents_ready",
      label: "Fiscalidad preparada",
      description: "Borradores fiscales sin bloqueos antes de cierre o regularización final.",
      done: input.fiscalBlocked === 0,
      blocking: false,
      area: "Facturación",
      href: "/facturacion",
      evidence: `${input.fiscalBlocked} documentos fiscales bloqueados o con error.`,
      action: "Validar contacto fiscal, pago y estado de documento.",
    },
    {
      id: "final_notes_saved",
      label: "Notas finales guardadas",
      description: "Incidencias, cambios y aprendizaje operativo registrados.",
      done: input.finalNotesSaved,
      blocking: false,
      area: "Expediente",
      href: "/expedientes",
      evidence: input.finalNotesSaved ? "Notas finales registradas." : "Notas finales pendientes.",
      action: "Registrar notas de cierre y aprendizajes.",
    },
  ];
}

export function closeSummary(checks: CloseCheck[]) {
  const done = checks.filter((check) => check.done).length;
  const blockingOpen = checks.filter((check) => check.blocking && !check.done).length;
  const informativeOpen = checks.filter((check) => !check.blocking && !check.done).length;
  const progress = checks.length === 0 ? 0 : Math.round((done / checks.length) * 100);
  const status = blockingOpen === 0 ? "ready_to_close" : "blocked";
  const nextAction = checks.find((check) => check.blocking && !check.done) || checks.find((check) => !check.done);
  return { done, total: checks.length, blockingOpen, informativeOpen, progress, status, nextAction };
}
