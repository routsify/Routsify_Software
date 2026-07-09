export type BudgetStatus = "draft" | "internal_review" | "sent" | "accepted" | "rejected" | "expired" | "locked";

export type BudgetMaster = {
  id: string;
  code: string;
  clientName: string;
  caseCode: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  status: BudgetStatus;
  currentVersion: number;
  responsibleName: string;
  totalCostBudget: number;
  totalSalePrice: number;
  expectedProfit: number;
  expectedMarginPct: number;
  realCost?: number;
  realProfit?: number;
  holdedSyncStatus: "synced" | "pending" | "error";
  holdedLastError?: string;
  sentAt?: string;
  acceptedAt?: string;
  expiresAt?: string;
  lastActivityAt: string;
};

export type BudgetLineMaster = { id: string; serviceType: string; description: string; providerName: string; costBudget: number; realCost?: number; marginPct: number; salePrice: number; expectedProfit: number; included: boolean; visibleToClient: boolean; requiresSupplierInvoice: boolean };
export type BudgetVersionMaster = { id: string; versionNumber: number; status: BudgetStatus; createdAt: string; summary: string };

export const budgetStatusConfig: Record<BudgetStatus, { label: string; tone: string; nextAction: string }> = {
  draft: { label: "Borrador", tone: "gray", nextAction: "Completar líneas y revisar margen" },
  internal_review: { label: "Revisión interna", tone: "blue", nextAction: "Aprobar margen o crear nueva versión" },
  sent: { label: "Enviado", tone: "green", nextAction: "Seguimiento cliente" },
  accepted: { label: "Aceptado", tone: "green", nextAction: "Solicitar viajeros y compras esperadas" },
  rejected: { label: "Rechazado", tone: "red", nextAction: "Registrar motivo" },
  expired: { label: "Caducado", tone: "red", nextAction: "Reactivar o duplicar" },
  locked: { label: "Bloqueado", tone: "gray", nextAction: "Solo lectura" },
};

export const budgetStatuses = Object.keys(budgetStatusConfig) as BudgetStatus[];
export const budgetOwners = ["Laura Pérez", "Diego Romero", "Sofía Martínez", "Carlos Vega"];
export const marginFilters = ["Todos", "Bajo", "Correcto", "Alto"];

export const demoBudgets: BudgetMaster[] = [
  { id: "budget-142", code: "PRES-2026-0142", clientName: "Juan Pérez", caseCode: "EXP-2026-0001", destination: "Japón", startDate: "2026-05-10", endDate: "2026-05-24", status: "sent", currentVersion: 3, responsibleName: "Laura Pérez", totalCostBudget: 10132, totalSalePrice: 12450, expectedProfit: 2318, expectedMarginPct: 18.6, realCost: 9980, realProfit: 2470, holdedSyncStatus: "pending", sentAt: "14/05/2026 09:25", expiresAt: "28/05/2026", lastActivityAt: "Hoy, 09:25" },
  { id: "budget-141", code: "PRES-2026-0141", clientName: "Ana López", caseCode: "EXP-2026-0002", destination: "Italia", status: "accepted", currentVersion: 2, responsibleName: "Diego Romero", totalCostBudget: 7766, totalSalePrice: 9870, expectedProfit: 2104, expectedMarginPct: 21.3, holdedSyncStatus: "synced", sentAt: "13/05/2026 10:10", acceptedAt: "16/05/2026 18:40", lastActivityAt: "Hoy, 11:10" },
  { id: "budget-140", code: "PRES-2026-0140", clientName: "Familia Gómez", caseCode: "EXP-2026-0003", destination: "Tailandia", status: "internal_review", currentVersion: 4, responsibleName: "Carlos Vega", totalCostBudget: 20615, totalSalePrice: 24600, expectedProfit: 3985, expectedMarginPct: 16.2, holdedSyncStatus: "pending", lastActivityAt: "Ayer, 18:40" },
  { id: "budget-139", code: "PRES-2026-0139", clientName: "Miguel Torres", caseCode: "EXP-2026-0004", destination: "Perú", status: "draft", currentVersion: 1, responsibleName: "Sofía Martínez", totalCostBudget: 6376, totalSalePrice: 7950, expectedProfit: 1574, expectedMarginPct: 19.8, holdedSyncStatus: "pending", lastActivityAt: "Ayer, 16:20" },
  { id: "budget-138", code: "PRES-2026-0138", clientName: "Lucía Martín", caseCode: "EXP-2026-0005", destination: "Islandia", status: "accepted", currentVersion: 2, responsibleName: "Laura Pérez", totalCostBudget: 12618, totalSalePrice: 15220, expectedProfit: 2602, expectedMarginPct: 17.1, holdedSyncStatus: "error", holdedLastError: "Estimate Holded pendiente de reintento", lastActivityAt: "22 May, 12:05" },
  { id: "budget-137", code: "PRES-2026-0137", clientName: "David Ortega", caseCode: "EXP-2026-0006", destination: "Marruecos", status: "expired", currentVersion: 1, responsibleName: "Diego Romero", totalCostBudget: 7207, totalSalePrice: 8430, expectedProfit: 1223, expectedMarginPct: 14.5, holdedSyncStatus: "pending", lastActivityAt: "22 May, 10:15" },
  { id: "budget-136", code: "PRES-2026-0136", clientName: "Sofía Ramírez", caseCode: "EXP-2026-0007", destination: "Egipto", status: "sent", currentVersion: 2, responsibleName: "Sofía Martínez", totalCostBudget: 14233, totalSalePrice: 17880, expectedProfit: 3647, expectedMarginPct: 20.4, holdedSyncStatus: "pending", lastActivityAt: "21 May, 17:50" },
  { id: "budget-135", code: "PRES-2026-0135", clientName: "Carlos Ruiz", caseCode: "EXP-2026-0008", destination: "Turquía", status: "rejected", currentVersion: 1, responsibleName: "Carlos Vega", totalCostBudget: 8976, totalSalePrice: 10560, expectedProfit: 1584, expectedMarginPct: 15.0, holdedSyncStatus: "pending", lastActivityAt: "20 May, 13:30" },
];

export const demoBudgetLines: BudgetLineMaster[] = [
  { id: "line-flight", serviceType: "flight", description: "Vuelo Madrid - Tokio", providerName: "Emirates", costBudget: 2500, marginPct: 19.9, salePrice: 3120, expectedProfit: 620, included: true, visibleToClient: true, requiresSupplierInvoice: true },
  { id: "line-hotel", serviceType: "hotel", description: "Hotel Shinjuku 14 noches", providerName: "Booking.com", costBudget: 2250, marginPct: 19.6, salePrice: 2800, expectedProfit: 550, included: true, visibleToClient: true, requiresSupplierInvoice: true },
  { id: "line-tour", serviceType: "activity", description: "Tour Tokio día completo", providerName: "Japan Experience", costBudget: 140, marginPct: 22.2, salePrice: 180, expectedProfit: 40, included: true, visibleToClient: true, requiresSupplierInvoice: true },
  { id: "line-insurance", serviceType: "insurance", description: "Seguro Premium", providerName: "IATI", costBudget: 94, marginPct: 21.7, salePrice: 120, expectedProfit: 26, included: true, visibleToClient: true, requiresSupplierInvoice: true },
];

export const demoBudgetVersions: BudgetVersionMaster[] = [
  { id: "v3", versionNumber: 3, status: "sent", createdAt: "14/05/2026 09:25", summary: "Snapshot enviado: venta, margen, líneas y condiciones." },
  { id: "v2", versionNumber: 2, status: "internal_review", createdAt: "13/05/2026 16:40", summary: "Revisión interna de margen y proveedor hotel." },
  { id: "v1", versionNumber: 1, status: "draft", createdAt: "12/05/2026 11:15", summary: "Primer borrador operativo." },
];

export function formatBudgetMoney(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
export function formatBudgetPercent(value: number) { return `${value.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
export function calculateSalePrice(cost: number, marginPct: number) { return cost / (1 - marginPct / 100); }
export function budgetKpis(budgets = demoBudgets) { return { active: budgets.filter((item) => !["rejected", "expired"].includes(item.status)).length, drafts: budgets.filter((item) => item.status === "draft").length, sentPending: budgets.filter((item) => item.status === "sent" || item.status === "internal_review").length, budgetedValue: budgets.reduce((sum, item) => sum + item.totalSalePrice, 0) }; }
export function marginBucket(value: number) { if (value < 16) return "Bajo"; if (value > 23) return "Alto"; return "Correcto"; }
export function filterBudgets(budgets: BudgetMaster[], filters: { search: string; status: string; owner: string; margin: string }) {
  const search = filters.search.trim().toLowerCase();
  return budgets.filter((item) => (!search || [item.code, item.clientName, item.caseCode, item.destination, item.responsibleName, budgetStatusConfig[item.status].label].some((value) => value.toLowerCase().includes(search))) && (filters.status === "Todos" || item.status === filters.status) && (filters.owner === "Todos" || item.responsibleName === filters.owner) && (filters.margin === "Todos" || marginBucket(item.expectedMarginPct) === filters.margin));
}
export function budgetAlerts(budget: BudgetMaster) { const alerts: string[] = []; if (budget.expectedMarginPct < 16) alerts.push("Margen bajo: requiere revisión interna"); if (budget.status === "sent") alerts.push("Enviado: seguimiento si no responde"); if (budget.holdedSyncStatus === "error") alerts.push(budget.holdedLastError || "Error Holded"); if (budget.status === "accepted") alerts.push("Aceptado: generar compras esperadas y solicitar viajeros"); if (budget.status === "expired") alerts.push("Caducado: reactivar o duplicar antes de aceptar"); return alerts; }
export function buildBudgetFlow(budget: BudgetMaster) { return [{ label: "Presupuesto creado", status: "completed" }, { label: "Márgenes revisados", status: budget.expectedMarginPct >= 16 ? "completed" : "blocked" }, { label: "Enviado al cliente", status: ["sent", "accepted"].includes(budget.status) ? "completed" : "pending" }, { label: "Aceptación cliente", status: budget.status === "accepted" ? "completed" : "pending" }, { label: "Compras esperadas", status: budget.status === "accepted" ? "completed" : "pending" }]; }
export function generateBudgetCode(budgets = demoBudgets) { const max = budgets.reduce((number, item) => Math.max(number, Number(item.code.split("-").pop()) || 0), 0); return `PRES-2026-${String(max + 1).padStart(4, "0")}`; }
export function createDemoBudget(input: { clientName: string; caseCode: string; destination: string; responsibleName: string; marginPct: number }, budgets = demoBudgets) { const budget: BudgetMaster = { id: `budget-demo-${Date.now()}`, code: generateBudgetCode(budgets), clientName: input.clientName, caseCode: input.caseCode, destination: input.destination, status: "draft", currentVersion: 1, responsibleName: input.responsibleName, totalCostBudget: 0, totalSalePrice: 0, expectedProfit: 0, expectedMarginPct: input.marginPct, holdedSyncStatus: "pending", lastActivityAt: "Ahora" }; return { budget, event: "budget.created", task: "Completar líneas y revisar margen" }; }
export function getBudgetDetail(budgetId: string) { const budget = demoBudgets.find((item) => item.id === budgetId || item.code === budgetId); return budget ? { budget, lines: demoBudgetLines, versions: demoBudgetVersions, flow: buildBudgetFlow(budget), alerts: budgetAlerts(budget) } : null; }
