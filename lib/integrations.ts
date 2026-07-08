export type IntegrationStatus = "pending" | "processing" | "done" | "failed" | "skipped";
export type IntegrationChannel = "form" | "booking" | "payment" | "fiscal" | "supplier";

export type OutboxItem = {
  id: string;
  channel: IntegrationChannel;
  event_type: string;
  related_case?: string;
  status: IntegrationStatus;
  attempts: number;
  created_at: string;
  last_error?: string;
  payload_summary: string;
};

export type IntegrationJob = {
  id: string;
  name: string;
  cadence: string;
  purpose: string;
  enabled: boolean;
};

export const integrationStatuses: IntegrationStatus[] = ["pending", "processing", "done", "failed", "skipped"];

export const demoOutbox: OutboxItem[] = [
  {
    id: "outbox-1",
    channel: "form",
    event_type: "lead.created",
    related_case: "EXP-2026-0001",
    status: "done",
    attempts: 1,
    created_at: "2026-02-01 10:15",
    payload_summary: "Lead recibido desde formulario y convertido en cliente demo.",
  },
  {
    id: "outbox-2",
    channel: "booking",
    event_type: "booking.requested",
    related_case: "EXP-2026-0002",
    status: "done",
    attempts: 1,
    created_at: "2026-02-03 12:40",
    payload_summary: "Solicitud de booking asociada al expediente.",
  },
  {
    id: "outbox-3",
    channel: "fiscal",
    event_type: "document.create_requested",
    related_case: "EXP-2026-0002",
    status: "pending",
    attempts: 0,
    created_at: "2026-02-10 09:00",
    payload_summary: "Documento fiscal listo para revisión antes de sincronizar.",
  },
  {
    id: "outbox-4",
    channel: "supplier",
    event_type: "supplier_invoice.review_required",
    related_case: "EXP-2026-0001",
    status: "failed",
    attempts: 2,
    created_at: "2026-02-11 16:20",
    last_error: "Factura proveedor pendiente de validación manual.",
    payload_summary: "Compra esperada necesita factura aprobada antes de cierre.",
  },
];

export const scheduledJobs: IntegrationJob[] = [
  {
    id: "job-1",
    name: "sync_pending_fiscal_documents",
    cadence: "manual / diario",
    purpose: "Revisar documentos fiscales listos y enviarlos solo si cumplen reglas de negocio.",
    enabled: false,
  },
  {
    id: "job-2",
    name: "pre_trip_supplier_check",
    cadence: "diario",
    purpose: "Detectar compras esperadas sin factura o proveedor no confirmado antes del viaje.",
    enabled: true,
  },
  {
    id: "job-3",
    name: "post_trip_supplier_check",
    cadence: "diario",
    purpose: "Detectar facturas proveedor pendientes tras el viaje.",
    enabled: true,
  },
  {
    id: "job-4",
    name: "operational_close_check",
    cadence: "diario",
    purpose: "Proponer expedientes listos para cierre o bloqueados por contrato, pago o proveedores.",
    enabled: true,
  },
  {
    id: "job-5",
    name: "privacy_retention_review",
    cadence: "mensual",
    purpose: "Revisar documentación sensible y retención de datos.",
    enabled: false,
  },
];

export function integrationSummary(items: OutboxItem[]) {
  const pending = items.filter((item) => item.status === "pending" || item.status === "processing").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const done = items.filter((item) => item.status === "done").length;
  return { total: items.length, pending, failed, done };
}
