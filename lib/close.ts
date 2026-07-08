export type CloseCheck = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  blocking: boolean;
};

export const defaultCloseChecks: CloseCheck[] = [
  {
    id: "proposal_accepted",
    label: "Propuesta aceptada",
    description: "La versión aceptada queda bloqueada para preservar precio, condiciones y margen.",
    done: true,
    blocking: true,
  },
  {
    id: "travelers_documented",
    label: "Viajeros y documentación mínima",
    description: "Datos mínimos de viajeros recogidos antes de contrato y operación final.",
    done: true,
    blocking: true,
  },
  {
    id: "contract_signed",
    label: "Contrato firmado",
    description: "Contrato firmado y asociado al expediente.",
    done: false,
    blocking: true,
  },
  {
    id: "payment_confirmed",
    label: "Pago confirmado",
    description: "Pago manual o transferencia confirmado antes de emitir compras críticas.",
    done: false,
    blocking: true,
  },
  {
    id: "supplier_invoices_reviewed",
    label: "Facturas proveedor revisadas",
    description: "Todas las compras esperadas tienen factura subida, aprobada o justificada.",
    done: false,
    blocking: true,
  },
  {
    id: "holded_documents_ready",
    label: "Documento Holded preparado",
    description: "Factura, proforma o regularización preparada según el modo fiscal elegido.",
    done: false,
    blocking: false,
  },
  {
    id: "final_notes_saved",
    label: "Notas finales guardadas",
    description: "Incidencias, cambios y aprendizaje operativo registrados antes del cierre.",
    done: false,
    blocking: false,
  },
];

export function closeSummary(checks: CloseCheck[]) {
  const done = checks.filter((check) => check.done).length;
  const blockingOpen = checks.filter((check) => check.blocking && !check.done).length;
  const progress = checks.length === 0 ? 0 : Math.round((done / checks.length) * 100);
  const status = blockingOpen === 0 ? "ready_to_close" : "blocked";
  return { done, total: checks.length, blockingOpen, progress, status };
}
