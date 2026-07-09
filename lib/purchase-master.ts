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
  notRequiredReason?: string;
  lastActivityAt: string;
};

export type HoldedPurchaseCandidate = { id: string; holdedPurchaseId: string; holdedDocumentNumber: string; providerName: string; amount: number; date: string; confidence: number; checks: string[]; holdedUrl: string };

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
export function purchaseKpis(items = demoExpectedPurchases) { return { expected: items.length, pending: items.filter((item) => !isPurchaseClosed(item)).length, incidents: items.filter((item) => item.status === "review_needed" || item.matchStatus === "issue").length, pendingValue: items.filter((item) => !isPurchaseClosed(item)).reduce((sum, item) => sum + item.expectedAmount, 0) }; }
export function confidenceBucket(item: ExpectedPurchase) { const confidence = item.matchConfidence || 0; if (!item.holdedPurchaseId) return "Sin documento"; if (item.matchStatus === "issue" || item.status === "review_needed") return "Incidencia"; if (confidence >= 90) return "Alta"; if (confidence >= 70) return "Media"; return "Baja"; }
export function filterPurchases(items: ExpectedPurchase[], filters: { search: string; status: string; provider: string; caseCode: string; match: string }) { const search = filters.search.trim().toLowerCase(); return items.filter((item) => (!search || [item.code, item.providerName, item.caseCode, item.clientName, item.destination, item.concept, item.holdedDocumentNumber, item.responsibleName].some((value) => String(value || "").toLowerCase().includes(search))) && (filters.status === "Todos" || item.status === filters.status) && (filters.provider === "Todos" || item.providerName === filters.provider) && (filters.caseCode === "Todos" || item.caseCode === filters.caseCode) && (filters.match === "Todos" || confidenceBucket(item) === filters.match)); }
export function holdedCandidate(item: ExpectedPurchase): HoldedPurchaseCandidate | null { if (!item.holdedPurchaseId || !item.holdedDocumentNumber) return null; const amountMatches = item.holdedAmount === item.expectedAmount; const providerMatches = true; const dateNear = Boolean(item.holdedDate); return { id: `${item.id}-candidate`, holdedPurchaseId: item.holdedPurchaseId, holdedDocumentNumber: item.holdedDocumentNumber, providerName: item.providerName, amount: item.holdedAmount || item.expectedAmount, date: item.holdedDate || "Pendiente", confidence: item.matchConfidence || 0, checks: [amountMatches ? "Importe coincide" : "Diferencia de importe", providerMatches ? "Proveedor coincide" : "Proveedor distinto", dateNear ? "Fecha cercana" : "Fecha pendiente"], holdedUrl: "https://app.holded.com" }; }
export function purchaseFlow(item: ExpectedPurchase) { return [{ label: "Compra esperada creada", status: "completed" }, { label: "Solicitud al proveedor", status: ["requested", "holded_candidate", "matched", "review_needed", "approved"].includes(item.status) ? "completed" : "pending" }, { label: "Documento candidato Holded", status: item.holdedPurchaseId ? "completed" : "pending" }, { label: "Revisión manual", status: item.status === "review_needed" ? "in_progress" : ["approved", "not_required"].includes(item.status) ? "completed" : "pending" }, { label: "Aprobación final", status: item.status === "approved" || item.status === "not_required" ? "completed" : "pending" }]; }
export function purchaseAlerts(item: ExpectedPurchase) { const alerts: string[] = []; if (purchaseStatusConfig[item.status].blocks) alerts.push("Bloquea cierre hasta aprobar o justificar"); if (!item.holdedPurchaseId) alerts.push("Sin documento Holded vinculado"); if (item.status === "review_needed") alerts.push("Revisión manual obligatoria"); if ((item.holdedAmount || item.expectedAmount) !== item.expectedAmount) alerts.push("Diferencia de importe"); return alerts; }
export function approvePurchaseMatch(item: ExpectedPurchase) { return { ...item, status: "approved" as ExpectedPurchaseStatus, matchStatus: "linked" as const, blocksCaseClosing: false, lastActivityAt: "Ahora" }; }
export function requestPurchaseInvoice(item: ExpectedPurchase) { return { ...item, status: "requested" as ExpectedPurchaseStatus, lastActivityAt: "Ahora" }; }
export function markPurchaseNotRequired(item: ExpectedPurchase, reason: string) { return { ...item, status: "not_required" as ExpectedPurchaseStatus, notRequiredReason: reason, blocksCaseClosing: false, lastActivityAt: "Ahora" }; }
export function getPurchaseDetail(purchaseId: string) { const purchase = demoExpectedPurchases.find((item) => item.id === purchaseId || item.code === purchaseId); return purchase ? { purchase, candidate: holdedCandidate(purchase), flow: purchaseFlow(purchase), alerts: purchaseAlerts(purchase), timeline: [{ title: "Compra esperada creada", createdAt: "12/05/2026", userName: "Sistema" }, { title: purchase.holdedPurchaseId ? "Documento candidato encontrado en Holded" : "Factura pendiente", createdAt: purchase.lastActivityAt, userName: purchase.responsibleName }], tasks: purchaseAlerts(purchase).map((alert) => ({ title: alert, assignedTo: purchase.responsibleName, status: "open" })), audit: [{ action: "expected_purchase.created", userName: "Sistema", createdAt: "12/05/2026" }] } : null; }
