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
  estimatedCost?: number;
  realCost?: number;
  realMarginPct?: number;
  budgetId?: string;
  acceptedBudgetVersionId?: string;
  purchaseStatus: "ok" | "pending" | "review_needed";
  contractStatus: "not_generated" | "generated" | "sent" | "signed";
  paymentStatus: "pending" | "confirmed" | "failed";
  holdedSyncStatus: "synced" | "pending" | "error";
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEvent = { id: string; caseId: string; type: string; title: string; description?: string; userName: string; createdAt: string };
export type FlowStep = { key: "budget" | "travelers_documents" | "contract" | "payment" | "supplier_purchases" | "holded" | "closing"; label: string; status: "completed" | "pending" | "in_progress" | "blocked"; blocker?: string; actionUrl: string };
export type CreateExpedienteInput = { clientName: string; destination: string; startDate?: string; endDate?: string; travelersCount?: number; responsibleName: string; priority: ExpedientePriority; internalNotes?: string };

export const statusConfig: Record<ExpedienteStatus, { label: string; tone: string; nextAction: string }> = {
  nuevo_lead: { label: "Nuevo lead", tone: "gray", nextAction: "Contactar o enviar enlace de llamada" },
  llamada_reservada: { label: "Llamada reservada", tone: "blue", nextAction: "Realizar llamada" },
  llamada_realizada: { label: "Llamada realizada", tone: "blue", nextAction: "Crear presupuesto" },
  presupuesto_en_preparacion: { label: "Presupuesto en preparación", tone: "amber", nextAction: "Revisar márgenes" },
  presupuesto_enviado: { label: "Presupuesto enviado", tone: "blue", nextAction: "Seguimiento cliente" },
  presupuesto_aceptado: { label: "Presupuesto aceptado", tone: "green", nextAction: "Solicitar viajeros y documentos" },
  documentacion_aprobada: { label: "Documentación aprobada", tone: "purple", nextAction: "Generar contrato" },
  contrato_pendiente: { label: "Contrato pendiente", tone: "amber", nextAction: "Enviar contrato" },
  contrato_firmado: { label: "Contrato firmado", tone: "green", nextAction: "Confirmar pago" },
  pago_pendiente: { label: "Pago pendiente", tone: "amber", nextAction: "Confirmar pago" },
  pago_confirmado: { label: "Pago confirmado", tone: "green", nextAction: "Crear documento Holded" },
  proveedores_pendientes: { label: "Proveedores pendientes", tone: "amber", nextAction: "Conciliar facturas" },
  listo_para_cierre: { label: "Listo para cierre", tone: "green", nextAction: "Revisar preflight de cierre" },
  cerrado: { label: "Cerrado", tone: "gray", nextAction: "Medir rentabilidad real" },
};

export const expedienteStatuses = Object.keys(statusConfig) as ExpedienteStatus[];
export const expedientePriorities: ExpedientePriority[] = ["alta", "media", "baja"];
export const expedienteOwners = ["Laura Pérez", "Diego Romero", "Sofía Martínez", "Carlos Vega"];

export const demoExpedientes: Expediente[] = [
  { id: "case-1", code: "EXP-2026-0001", clientName: "Juan Pérez", destination: "Japón", startDate: "2026-05-10", endDate: "2026-05-24", status: "contrato_pendiente", nextAction: "Enviar contrato", blocker: null, priority: "alta", responsibleName: "Laura Pérez", travelersSummary: "2 adultos", acceptedValue: 12450, estimatedMarginPct: 18.6, estimatedCost: 10134, realCost: 10080, realMarginPct: 19.0, budgetId: "BUD-2026-0001", acceptedBudgetVersionId: "BUDV-0001-v3", purchaseStatus: "review_needed", contractStatus: "generated", paymentStatus: "pending", holdedSyncStatus: "pending", lastActivityAt: "Hoy, 09:25", createdAt: "20 May, 15:20", updatedAt: "Hoy, 09:25" },
  { id: "case-2", code: "EXP-2026-0002", clientName: "Ana López", destination: "Italia", startDate: "2026-06-03", endDate: "2026-06-12", status: "presupuesto_enviado", nextAction: "Seguimiento cliente", blocker: "Cliente pendiente de responder", priority: "media", responsibleName: "Diego Romero", travelersSummary: "2 adultos", acceptedValue: 18200, estimatedMarginPct: 20.1, estimatedCost: 14500, budgetId: "BUD-2026-0002", purchaseStatus: "pending", contractStatus: "not_generated", paymentStatus: "pending", holdedSyncStatus: "pending", lastActivityAt: "Hoy, 11:10", createdAt: "18 May, 10:40", updatedAt: "Hoy, 11:10" },
  { id: "case-3", code: "EXP-2026-0003", clientName: "Familia Gómez", destination: "Tailandia", startDate: "2026-07-12", endDate: "2026-07-27", status: "proveedores_pendientes", nextAction: "Conciliar factura hotel", blocker: "Compra proveedor en revisión", priority: "alta", responsibleName: "Carlos Vega", travelersSummary: "2 adultos · 2 niños", acceptedValue: 28600, estimatedMarginPct: 21.3, estimatedCost: 22510, budgetId: "BUD-2026-0003", acceptedBudgetVersionId: "BUDV-0003-v2", purchaseStatus: "review_needed", contractStatus: "signed", paymentStatus: "confirmed", holdedSyncStatus: "synced", lastActivityAt: "Ayer, 18:40", createdAt: "10 May, 12:00", updatedAt: "Ayer, 18:40" },
  { id: "case-4", code: "EXP-2026-0004", clientName: "Miguel Torres", destination: "Perú", startDate: "2026-08-02", endDate: "2026-08-14", status: "documentacion_aprobada", nextAction: "Generar contrato", blocker: null, priority: "media", responsibleName: "Sofía Martínez", travelersSummary: "1 adulto", acceptedValue: 12300, estimatedMarginPct: 22.4, estimatedCost: 9545, budgetId: "BUD-2026-0004", acceptedBudgetVersionId: "BUDV-0004-v1", purchaseStatus: "pending", contractStatus: "not_generated", paymentStatus: "pending", holdedSyncStatus: "pending", lastActivityAt: "Ayer, 16:20", createdAt: "09 May, 09:30", updatedAt: "Ayer, 16:20" },
  { id: "case-5", code: "EXP-2026-0005", clientName: "Lucía Martín", destination: "Islandia", startDate: "2026-09-04", endDate: "2026-09-12", status: "pago_confirmado", nextAction: "Crear documento Holded", blocker: "Error Holded: falta NIF", priority: "alta", responsibleName: "Laura Pérez", travelersSummary: "2 adultos", acceptedValue: 9750, estimatedMarginPct: 17.8, estimatedCost: 8014, budgetId: "BUD-2026-0005", acceptedBudgetVersionId: "BUDV-0005-v2", purchaseStatus: "ok", contractStatus: "signed", paymentStatus: "confirmed", holdedSyncStatus: "error", lastActivityAt: "22 May, 12:05", createdAt: "05 May, 08:20", updatedAt: "22 May, 12:05" },
  { id: "case-6", code: "EXP-2026-0006", clientName: "David Ortega", destination: "Marruecos", startDate: "2026-10-11", endDate: "2026-10-17", status: "llamada_realizada", nextAction: "Crear presupuesto", blocker: "Faltan datos finales de viaje", priority: "media", responsibleName: "Diego Romero", travelersSummary: "2 adultos", acceptedValue: 0, estimatedMarginPct: 0, purchaseStatus: "pending", contractStatus: "not_generated", paymentStatus: "pending", holdedSyncStatus: "pending", lastActivityAt: "22 May, 10:15", createdAt: "21 May, 09:00", updatedAt: "22 May, 10:15" },
  { id: "case-7", code: "EXP-2026-0007", clientName: "Sofía Ramírez", destination: "Egipto", startDate: "2026-11-01", endDate: "2026-11-09", status: "presupuesto_en_preparacion", nextAction: "Revisar márgenes", blocker: "Faltan costes proveedores", priority: "baja", responsibleName: "Sofía Martínez", travelersSummary: "2 adultos", acceptedValue: 0, estimatedMarginPct: 0, purchaseStatus: "pending", contractStatus: "not_generated", paymentStatus: "pending", holdedSyncStatus: "pending", lastActivityAt: "21 May, 17:50", createdAt: "20 May, 17:00", updatedAt: "21 May, 17:50" },
  { id: "case-8", code: "EXP-2026-0008", clientName: "Carlos Ruiz", destination: "Turquía", startDate: "2026-03-01", endDate: "2026-03-08", status: "cerrado", nextAction: "Medir rentabilidad", blocker: null, priority: "baja", responsibleName: "Carlos Vega", travelersSummary: "2 adultos", acceptedValue: 24800, estimatedMarginPct: 19.9, estimatedCost: 19865, realCost: 19720, realMarginPct: 20.5, budgetId: "BUD-2026-0008", acceptedBudgetVersionId: "BUDV-0008-v1", purchaseStatus: "ok", contractStatus: "signed", paymentStatus: "confirmed", holdedSyncStatus: "synced", lastActivityAt: "20 May, 13:30", createdAt: "10 Feb, 13:00", updatedAt: "20 May, 13:30" },
];

export function getNextAction(expediente: Pick<Expediente, "status">) { return statusConfig[expediente.status]?.nextAction || "Revisar expediente"; }
export function formatCaseMoney(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
export function formatCasePercent(value: number) { return `${value.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
export function canCloseCase(expediente: Expediente) { return expediente.paymentStatus === "confirmed" && expediente.contractStatus === "signed" && expediente.purchaseStatus === "ok" && expediente.holdedSyncStatus !== "error"; }

export function buildExpedienteFlow(expediente: Expediente): FlowStep[] {
  return [
    { key: "budget", label: "Presupuesto aceptado", status: expediente.acceptedBudgetVersionId ? "completed" : "pending", actionUrl: "/propuestas" },
    { key: "travelers_documents", label: "Documentación aprobada", status: ["documentacion_aprobada", "contrato_pendiente", "contrato_firmado", "pago_confirmado", "proveedores_pendientes", "listo_para_cierre", "cerrado"].includes(expediente.status) ? "completed" : "pending", actionUrl: "/viajeros" },
    { key: "contract", label: expediente.contractStatus === "signed" ? "Contrato firmado" : "Contrato pendiente", status: expediente.contractStatus === "signed" ? "completed" : expediente.contractStatus === "generated" || expediente.contractStatus === "sent" ? "in_progress" : "pending", blocker: expediente.contractStatus === "not_generated" ? "Falta generar contrato" : undefined, actionUrl: "/contratos" },
    { key: "payment", label: expediente.paymentStatus === "confirmed" ? "Pago confirmado" : "Pago pendiente", status: expediente.paymentStatus === "confirmed" ? "completed" : expediente.paymentStatus === "failed" ? "blocked" : "pending", blocker: expediente.paymentStatus === "failed" ? "Pago fallido" : undefined, actionUrl: "/contratos" },
    { key: "supplier_purchases", label: "Compras en revisión", status: expediente.purchaseStatus === "ok" ? "completed" : expediente.purchaseStatus === "review_needed" ? "in_progress" : "pending", blocker: expediente.purchaseStatus !== "ok" ? "Compra proveedor pendiente" : undefined, actionUrl: "/compras" },
    { key: "holded", label: "Holded", status: expediente.holdedSyncStatus === "synced" ? "completed" : expediente.holdedSyncStatus === "error" ? "blocked" : "pending", blocker: expediente.holdedSyncStatus === "error" ? "Error Holded" : undefined, actionUrl: "/ajustes" },
    { key: "closing", label: "Cierre", status: canCloseCase(expediente) ? "completed" : "pending", actionUrl: `/expedientes/${expediente.code}` },
  ];
}

export function caseBlockers(expediente: Expediente) {
  const blockers = [expediente.blocker];
  if (!expediente.acceptedBudgetVersionId && expediente.status !== "cerrado") blockers.push("Presupuesto sin aceptar");
  if (expediente.contractStatus !== "signed" && ["documentacion_aprobada", "contrato_pendiente", "contrato_firmado"].includes(expediente.status)) blockers.push("Contrato pendiente");
  if (expediente.paymentStatus !== "confirmed" && expediente.acceptedBudgetVersionId) blockers.push("Pago pendiente");
  if (expediente.purchaseStatus !== "ok") blockers.push("Compras proveedor pendientes");
  if (expediente.holdedSyncStatus === "error") blockers.push("Error Holded");
  return Array.from(new Set(blockers.filter(Boolean) as string[]));
}

export function expedienteKpis(expedientes = demoExpedientes) {
  return { activeCases: expedientes.filter((item) => item.status !== "cerrado").length, pendingActionCases: expedientes.filter((item) => item.status !== "cerrado" && Boolean(item.nextAction)).length, supplierPendingCases: expedientes.filter((item) => item.purchaseStatus === "pending" || item.purchaseStatus === "review_needed").length, acceptedValueTotal: expedientes.filter((item) => item.acceptedBudgetVersionId).reduce((sum, item) => sum + item.acceptedValue, 0) };
}

export function filterExpedientes(expedientes: Expediente[], filters: { search: string; status: string; owner: string; priority: string }) {
  const search = filters.search.trim().toLowerCase();
  return expedientes.filter((item) => (!search || [item.code, item.clientName, item.destination, item.responsibleName, item.nextAction, statusConfig[item.status].label].some((value) => value.toLowerCase().includes(search))) && (filters.status === "Todos" || item.status === filters.status) && (filters.owner === "Todos" || item.responsibleName === filters.owner) && (filters.priority === "Todos" || item.priority === filters.priority));
}

export function generateExpCode(expedientes = demoExpedientes) { const max = expedientes.reduce((number, item) => Math.max(number, Number(item.code.split("-").pop()) || 0), 0); return `EXP-2026-${String(max + 1).padStart(4, "0")}`; }

export function createDemoExpediente(input: CreateExpedienteInput, expedientes = demoExpedientes) {
  const expediente: Expediente = { id: `case-demo-${Date.now()}`, code: generateExpCode(expedientes), clientName: input.clientName, destination: input.destination, startDate: input.startDate || "", endDate: input.endDate || "", status: "nuevo_lead", nextAction: "Contactar o enviar enlace de llamada", blocker: "Sin llamada reservada", priority: input.priority, responsibleName: input.responsibleName, travelersSummary: `${input.travelersCount || 1} viajero(s)`, acceptedValue: 0, estimatedMarginPct: 0, purchaseStatus: "pending", contractStatus: "not_generated", paymentStatus: "pending", holdedSyncStatus: "pending", lastActivityAt: "Ahora", createdAt: "Ahora", updatedAt: "Ahora" };
  const timeline: TimelineEvent = { id: `tl-${Date.now()}`, caseId: expediente.id, type: "case_created", title: "Expediente creado", description: input.internalNotes, userName: input.responsibleName, createdAt: "Ahora" };
  return { expediente, timeline, auditEvent: { entityType: "case", entityId: expediente.id, action: "case_created", userId: input.responsibleName, createdAt: "Ahora" } };
}

export function getCaseTimeline(expediente: Expediente) {
  if (expediente.id === "case-1") return [
    { id: "tl-1", caseId: "case-1", type: "case_created", title: "Expediente creado", userName: "Laura Pérez", createdAt: "20 May, 15:20" },
    { id: "tl-2", caseId: "case-1", type: "budget_sent", title: "Propuesta enviada al cliente", userName: "Laura Pérez", createdAt: "Ayer, 11:30" },
    { id: "tl-3", caseId: "case-1", type: "purchases_reconciled", title: "Compras conciliadas", userName: "Carlos Vega", createdAt: "Ayer, 16:45" },
    { id: "tl-4", caseId: "case-1", type: "documents_uploaded", title: "Documentos cargados", userName: "Laura Pérez", createdAt: "Hoy, 09:10" },
    { id: "tl-5", caseId: "case-1", type: "budget_created", title: "Presupuesto actualizado", userName: "Laura Pérez", createdAt: "Hoy, 09:25" },
  ];
  return [{ id: `${expediente.id}-created`, caseId: expediente.id, type: "case_created", title: "Expediente creado", userName: expediente.responsibleName, createdAt: expediente.createdAt }, { id: `${expediente.id}-updated`, caseId: expediente.id, type: "case_updated", title: statusConfig[expediente.status].label, userName: expediente.responsibleName, createdAt: expediente.lastActivityAt }];
}

export function getCaseDetail(codeOrId: string) {
  const expediente = demoExpedientes.find((item) => item.code === codeOrId || item.id === codeOrId);
  if (!expediente) return null;
  return { expediente, timeline: getCaseTimeline(expediente), flow: buildExpedienteFlow(expediente), financialSummary: { travelersSummary: expediente.travelersSummary, acceptedValue: expediente.acceptedValue, estimatedMarginPct: expediente.estimatedMarginPct, estimatedCost: expediente.estimatedCost, realCost: expediente.realCost, realMarginPct: expediente.realMarginPct } };
}
