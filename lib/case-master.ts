export type ExpedienteStatus = "nuevo_lead" | "llamada_reservada" | "llamada_realizada" | "presupuesto_en_preparacion" | "presupuesto_enviado" | "presupuesto_aceptado" | "documentacion_aprobada" | "contrato_pendiente" | "contrato_firmado" | "pago_pendiente" | "pago_confirmado" | "proveedores_pendientes" | "listo_para_cierre" | "cerrado";

export type ExpedientePriority = "alta" | "media" | "baja";

export type Expediente = {
  id: string;
  code: string;
  clientName: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: ExpedienteStatus;
  nextAction: string;
  blocker: string | null;
  priority: ExpedientePriority;
  responsibleName: string;
  travelersSummary: string;
  acceptedValue: number;
  estimatedMarginPct: number;
  purchaseStatus: "ok" | "pending" | "review_needed";
  contractStatus: "not_generated" | "generated" | "sent" | "signed";
  paymentStatus: "pending" | "confirmed" | "failed";
  holdedSyncStatus: "synced" | "pending" | "error";
  lastActivityAt: string;
};
