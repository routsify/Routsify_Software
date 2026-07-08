export type IntegrationStatus = "pending" | "manual_review" | "processing" | "done" | "failed" | "skipped";
export type IntegrationChannel = "form" | "booking" | "payment" | "fiscal" | "supplier";
export type IntegrationRisk = "low" | "medium" | "high";

export type OutboxItem = {
  id: string;
  channel: IntegrationChannel;
  event_type: string;
  related_case?: string;
  status: IntegrationStatus;
  attempts: number;
  max_attempts?: number;
  risk?: IntegrationRisk;
  created_at: string;
  last_attempt_at?: string;
  last_error?: string;
  payload_summary: string;
  business_rule?: string;
  next_action?: string;
};

export type IntegrationJob = {
  id: string;
  name: string;
  cadence: string;
  purpose: string;
  enabled: boolean;
  owner?: string;
  last_run_at?: string;
  next_run_hint?: string;
};

export const integrationStatuses: IntegrationStatus[] = ["pending", "manual_review", "processing", "done", "failed", "skipped"];

export const demoOutbox: OutboxItem[] = [
  { id: "outbox-1", channel: "form", event_type: "lead.created", related_case: "EXP-2026-0001", status: "done", attempts: 1, max_attempts: 3, risk: "low", created_at: "2026-02-01 10:15", last_attempt_at: "2026-02-01 10:16", payload_summary: "Lead recibido desde formulario y convertido en cliente demo.", business_rule: "La entrada debe crear solicitud antes que expediente." },
  { id: "outbox-2", channel: "booking", event_type: "booking.requested", related_case: "EXP-2026-0002", status: "done", attempts: 1, max_attempts: 3, risk: "medium", created_at: "2026-02-03 12:40", last_attempt_at: "2026-02-03 12:41", payload_summary: "Solicitud de booking asociada al expediente.", business_rule: "Booking solo entra como solicitud hasta validar encaje." },
  { id: "outbox-3", channel: "fiscal", event_type: "document.create_requested", related_case: "EXP-2026-0002", status: "manual_review", attempts: 0, max_attempts: 2, risk: "high", created_at: "2026-02-10 09:00", payload_summary: "Documento fiscal listo para revisión antes de sincronizar.", business_rule: "No enviar si falta contacto fiscal, pago o revisión interna.", next_action: "Validar documento fiscal antes de procesar." },
  { id: "outbox-4", channel: "supplier", event_type: "supplier_invoice.review_required", related_case: "EXP-2026-0001", status: "failed", attempts: 2, max_attempts: 2, risk: "high", created_at: "2026-02-11 16:20", last_error: "Factura proveedor pendiente de validación manual.", payload_summary: "Compra esperada necesita factura aprobada antes de cierre.", business_rule: "No reintentar si falta revisión humana de factura proveedor.", next_action: "Resolver compra/factura antes de reintentar." },
];

export const scheduledJobs: IntegrationJob[] = [
  { id: "job-1", name: "sync_pending_fiscal_documents", cadence: "manual / diario", purpose: "Revisar documentos fiscales listos y enviarlos solo si cumplen reglas de negocio.", enabled: false, owner: "Facturación", next_run_hint: "Activar cuando Holded esté configurado." },
  { id: "job-2", name: "pre_trip_supplier_check", cadence: "diario", purpose: "Detectar compras esperadas sin factura o proveedor no confirmado antes del viaje.", enabled: true, owner: "Operaciones", last_run_at: "2026-02-12" },
  { id: "job-3", name: "post_trip_supplier_check", cadence: "diario", purpose: "Detectar facturas proveedor pendientes tras el viaje.", enabled: true, owner: "Operaciones", last_run_at: "2026-02-12" },
  { id: "job-4", name: "operational_close_check", cadence: "diario", purpose: "Proponer expedientes listos para cierre o bloqueados por contrato, pago o proveedores.", enabled: true, owner: "Dirección", last_run_at: "2026-02-12" },
  { id: "job-5", name: "privacy_retention_review", cadence: "mensual", purpose: "Revisar documentación sensible y retención de datos.", enabled: false, owner: "Admin", next_run_hint: "Activar al pasar a datos reales." },
];

export function needsManualReview(item: OutboxItem) {
  if (item.status === "manual_review") return true;
  if (item.risk === "high" && (item.channel === "fiscal" || item.channel === "supplier")) return true;
  if (item.attempts >= (item.max_attempts ?? 3) && item.status !== "done" && item.status !== "skipped") return true;
  return false;
}

export function canProcessIntegration(item: OutboxItem) {
  return item.status === "pending" && !needsManualReview(item);
}

export function integrationNextAction(item: OutboxItem) {
  if (item.status === "done") return "Completado. Mantener trazabilidad.";
  if (item.status === "skipped") return "Omitido con criterio operativo.";
  if (needsManualReview(item)) return item.next_action || "Revisión manual antes de procesar.";
  if (item.status === "failed") return "Revisar error y preparar reintento controlado.";
  if (item.status === "processing") return "Esperar resultado o marcar error.";
  return "Listo para proceso controlado.";
}

export function integrationSummary(items: OutboxItem[]) {
  const pending = items.filter((item) => item.status === "pending" || item.status === "processing").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const done = items.filter((item) => item.status === "done").length;
  const manualReview = items.filter((item) => needsManualReview(item)).length;
  const highRisk = items.filter((item) => item.risk === "high").length;
  return { total: items.length, pending, failed, done, manualReview, highRisk };
}
