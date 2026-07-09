export type ExpectedPurchaseStatus = "expected" | "requested" | "holded_candidate" | "matched" | "review_needed" | "approved" | "not_required" | "cancelled";
export type PurchasePriority = "high" | "medium" | "low";

export type ExpectedPurchase = {
  id: string;
  code: string;
  caseCode: string;
  clientName: string;
  budgetId: string;
  budgetVersionId: string;
  budgetLineId: string;
  providerName: string;
  concept: string;
  serviceType: "flight" | "hotel" | "transfer" | "activity" | "insurance" | "guide" | "other";
  expectedAmount: number;
  currency: "EUR";
  destination: string;
  expectedDate?: string;
  status: ExpectedPurchaseStatus;
  responsibleName: string;
  priority: PurchasePriority;
  matchStatus: "none" | "candidate" | "linked" | "issue";
  blocksCaseClosing: boolean;
  holdedPurchaseId?: string;
  holdedDocumentNumber?: string;
  holdedAmount?: number;
  holdedDate?: string;
  matchConfidence?: number;
  lastActivityAt: string;
};

export type HoldedPurchaseCandidate = {
  id: string;
  holdedPurchaseId: string;
  holdedDocumentNumber: string;
  providerName: string;
  amount: number;
  date: string;
  confidence: number;
  checks: string[];
  holdedUrl: string;
};

export const purchaseStatuses: ExpectedPurchaseStatus[] = ["expected", "requested", "holded_candidate", "matched", "review_needed", "approved", "not_required", "cancelled"];
export const purchaseProviders = ["Todos", "Emirates", "Booking.com", "Japan Experience", "IATI", "Welcome Pickups", "JR Pass", "Hotel Glacier", "Nile Cruises"];
export const purchaseCaseFilters = ["Todos", "EXP-2026-0001", "EXP-2026-0002", "EXP-2026-0003", "EXP-2026-0004", "EXP-2026-0007"];
export const purchaseMatchFilters = ["Todos", "Alta", "Media", "Baja", "Incidencia", "Sin documento"];

export const purchaseStatusConfig: Record<ExpectedPurchaseStatus, { label: string; tone: string; blocks: boolean; nextAction: string }> = {
  expected: { label: "expected", tone: "gray", blocks: true, nextAction: "Solicitar factura o buscar en Holded" },
  requested: { label: "requested", tone: "blue", blocks: true, nextAction: "Esperar o reclamar proveedor" },
  holded_candidate: { label: "holded_candidate", tone: "purple", blocks: true, nextAction: "Revisar candidato Holded" },
  matched: { label: "matched", tone: "green", blocks: true, nextAction: "Aprobar match" },
  review_needed: { label: "review_needed", tone: "amber", blocks: true, nextAction: "Revisión manual obligatoria" },
  approved: { label: "approved", tone: "green", blocks: false, nextAction: "Usar coste real en cierre" },
  not_required: { label: "not_required", tone: "gray", blocks: false, nextAction: "Conservar motivo auditado" },
  cancelled: { label: "cancelled", tone: "gray", blocks: false, nextAction: "Solo histórico" },
};

export const demoExpectedPurchases: ExpectedPurchase[] = [
  { id: "purchase-412", code: "COMP-2026-0412", caseCode: "EXP-2026-0001", clientName: "Juan Pérez", budgetId: "PRES-2026-0142", budgetVersionId: "v3", budgetLineId: "line-flight", providerName: "Emirates", concept: "Vuelo Madrid → Tokio", serviceType: "flight", expectedAmount: 3120, currency: "EUR", destination: "Japón", expectedDate: "2026-05-13", status: "matched", responsibleName: "Carlos Vega", priority: "medium", matchStatus: "linked", blocksCaseClosing: true, holdedPurchaseId: "holded-8842", holdedDocumentNumber: "FAC-2026-8842", holdedAmount: 3120, holdedDate: "2026-05-13", matchConfidence: 97, lastActivityAt: "Hoy, 09:15" },
  { id: "purchase-411", code: "COMP-2026-0411", caseCode: "EXP-2026-0001", clientName: "Juan Pérez", budgetId: "PRES-2026-0142", budgetVersionId: "v3", budgetLineId: "line-hotel", providerName: "Booking.com", concept: "Hotel Shinjuku 14 noches", serviceType: "hotel", expectedAmount: 2800, currency: "EUR", destination: "Japón", expectedDate: "2026-05-13", status: "requested", responsibleName: "Laura Pérez", priority: "high", matchStatus: "candidate", blocksCaseClosing: true, holdedPurchaseId: "holded-8842b", holdedDocumentNumber: "FAC-2026-8842", holdedAmount: 2800, holdedDate: "2026-05-13", matchConfidence: 92, lastActivityAt: "Hoy, 08:40" },
  { id: "purchase-410", code: "COMP-2026-0410", caseCode: "EXP-2026-0001", clientName: "Juan Pérez", budgetId: "PRES-2026-0142", budgetVersionId: "v3", budgetLineId: "line-tour", providerName: "Japan Experience", concept: "Tour Tokio día completo", serviceType: "activity", expectedAmount: 180, currency: "EUR", destination: "Japón", expectedDate: "2026-05-14", status: "review_needed", responsibleName: "Carlos Vega", priority: "medium", matchStatus: "issue", blocksCaseClosing: true, holdedPurchaseId: "holded-8810", holdedDocumentNumber: "FAC-2026-8810", holdedAmount: 210, holdedDate: "2026-05-15", matchConfidence: 71, lastActivityAt: "Ayer, 18:20" },
  { id: "purchase-409", code: "COMP-2026-0409", caseCode: "EXP-2026-0001", clientName: "Juan Pérez", budgetId: "PRES-2026-0142", budgetVersionId: "v3", budgetLineId: "line-insurance", providerName: "IATI", concept: "Seguro Premium", serviceType: "insurance", expectedAmount: 120, currency: "EUR", destination: "Japón", expectedDate: "2026-05-13", status: "approved", responsibleName: "Laura Pérez", priority: "low", matchStatus: "linked", blocksCaseClosing: false, holdedPurchaseId: "holded-8809", holdedDocumentNumber: "FAC-2026-8809", holdedAmount: 120, holdedDate: "2026-05-13", matchConfidence: 99, lastActivityAt: "Ayer, 17:05" },
  { id: "purchase-408", code: "COMP-2026-0408", caseCode: "EXP-2026-0002", clientName: "Ana López", budgetId: "PRES-2026-0141", budgetVersionId: "v2", budgetLineId: "line-transfer", providerName: "Welcome Pickups", concept: "Traslado aeropuerto", serviceType: "transfer", expectedAmount: 95, currency: "EUR", destination: "Italia", status: "holded_candidate", responsibleName: "Diego Romero", priority: "medium", matchStatus: "candidate", blocksCaseClosing: true, holdedPurchaseId: "holded-8788", holdedDocumentNumber: "FAC-2026-8788", holdedAmount: 95, holdedDate: "2026-05-12", matchConfidence: 88, lastActivityAt: "Ayer, 15:10" },
  { id: "purchase-407", code: "COMP-2026-0407", caseCode: "EXP-2026-0003", clientName: "Familia Gómez", budgetId: "PRES-2026-0140", budgetVersionId: "v4", budgetLineId: "line-rail", providerName: "JR Pass", concept: "Rail Pass 14 días", serviceType: "transfer", expectedAmount: 420, currency: "EUR", destination: "Japón", status: "expected", responsibleName: "Sofía Martínez", priority: "low", matchStatus: "none", blocksCaseClosing: true, lastActivityAt: "22 May, 12:30" },
  { id: "purchase-406", code: "COMP-2026-0406", caseCode: "EXP-2026-0004", clientName: "Miguel Torres", budgetId: "PRES-2026-0139", budgetVersionId: "v1", budgetLineId: "line-glacier", providerName: "Hotel Glacier", concept: "Alojamiento Islandia", serviceType: "hotel", expectedAmount: 1950, currency: "EUR", destination: "Islandia", status: "review_needed", responsibleName: "Carlos Vega", priority: "high", matchStatus: "issue", blocksCaseClosing: true, holdedPurchaseId: "holded-8706", holdedDocumentNumber: "FAC-2026-8706", holdedAmount: 2150, holdedDate: "2026-05-10", matchConfidence: 64, lastActivityAt: "22 May, 10:20" },
  { id: "purchase-405", code: "COMP-2026-0405", caseCode: "EXP-2026-0007", clientName: "Sofía Ramírez", budgetId: "PRES-2026-0136", budgetVersionId: "v2", budgetLineId: "line-cruise", providerName: "Nile Cruises", concept: "Crucero Nilo", serviceType: "activity", expectedAmount: 2430, currency: "EUR", destination: "Egipto", status: "approved", responsibleName: "Laura Pérez", priority: "medium", matchStatus: "linked", blocksCaseClosing: false, holdedPurchaseId: "holded-8705", holdedDocumentNumber: "FAC-2026-8705", holdedAmount: 2430, holdedDate: "2026-05-08", matchConfidence: 96, lastActivityAt: "21 May, 16:10" },
];

export function formatPurchaseMoney(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
export function isPurchaseClosed(item: ExpectedPurchase) { return ["approved", "not_required", "cancelled"].includes(item.status); }
export function purchaseKpis(items = demoExpectedPurchases) { return { expected: items.length, pending: items.filter((item) => !isPurchaseClosed(item)).length, incidents: items.filter((item) => item.status === "review_needed" || item.matchStatus === "issue" || item.holdedSyncStatus === "error").length, pendingValue: items.filter((item) => !isPurchaseClosed(item)).reduce((sum, item) => sum + item.expectedAmount, 0) }; }
