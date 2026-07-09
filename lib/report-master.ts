import { demoBudgets } from "@/lib/budget-master";
import { demoClientMasters } from "@/lib/client-master";
import { demoExpedientes } from "@/lib/case-master";
import { demoExpectedPurchases, isPurchaseClosed } from "@/lib/purchase-master";

export type ReportTab = "executive" | "economic" | "budgets" | "clients" | "timing" | "suppliers" | "profitability" | "team";
export type ReportFilters = { from: string; to: string; compare: string; responsible: string; origin: string; destination: string; caseStatus: string; onlyBlocked: boolean; onlyIssues: boolean };
export type PainSeverity = "high" | "medium" | "low";

export const reportTabs: { id: ReportTab; label: string }[] = [
  { id: "executive", label: "Resumen ejecutivo" },
  { id: "economic", label: "Económicos" },
  { id: "budgets", label: "Presupuestos" },
  { id: "clients", label: "Clientes" },
  { id: "timing", label: "Tiempos y productividad" },
  { id: "suppliers", label: "Proveedores" },
  { id: "profitability", label: "Rentabilidad" },
  { id: "team", label: "Equipo" },
];

export const defaultReportFilters: ReportFilters = { from: "2026-05-01", to: "2026-05-31", compare: "Mes anterior", responsible: "Todos", origin: "Todos", destination: "Todos", caseStatus: "Todos", onlyBlocked: false, onlyIssues: false };

export const reportFilterOptions = {
  responsible: ["Todos", "Laura Pérez", "Diego Romero", "Sofía Martínez", "Carlos Vega"],
  origin: ["Todos", "Web", "Fillout", "Booking", "Referral", "Agencia", "Manual"],
  destination: ["Todos", "Japón", "Italia", "Tailandia", "Perú", "Islandia", "Marruecos", "Egipto", "Turquía"],
  caseStatus: ["Todos", "Presupuesto enviado", "Aceptado", "Contrato pendiente", "Pago confirmado", "Proveedores pendientes", "Cerrado"],
  compare: ["Mes anterior", "Periodo anterior", "Año anterior", "Sin comparación"],
};

export function formatReportMoney(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
export function formatReportPercent(value: number) { return `${value.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }
export function reportDrilldownUrl(target: "cases" | "budgets" | "purchases" | "clients", query: Record<string, string | number | boolean>) { const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])); const base = target === "cases" ? "/expedientes" : target === "budgets" ? "/propuestas" : target === "purchases" ? "/compras" : "/clientes"; return `${base}?${params.toString()}`; }

export function reportSummary() {
  const acceptedBudgets = demoBudgets.filter((budget) => budget.status === "accepted" || budget.status === "sent");
  const acceptedValue = acceptedBudgets.reduce((sum, budget) => sum + budget.totalSalePrice, 0);
  const confirmedRevenue = demoExpedientes.filter((item) => item.paymentStatus === "confirmed").reduce((sum, item) => sum + item.acceptedValue, 0);
  const estimatedProfit = acceptedBudgets.reduce((sum, budget) => sum + budget.expectedProfit, 0);
  const averageMarginPct = acceptedValue > 0 ? (estimatedProfit / acceptedValue) * 100 : 0;
  const activeCases = demoExpedientes.filter((item) => item.status !== "cerrado").length;
  const pendingTasks = buildPainPoints().reduce((sum, item) => sum + item.count, 0);
  return { kpis: { acceptedValue, confirmedRevenue, averageMarginPct, estimatedProfit, activeCases, pendingTasks }, comparison: { acceptedValuePct: 18.6, confirmedRevenuePct: 12.2, averageMarginPp: 2.1, estimatedProfitPct: 21.3, activeCasesDiff: 12, pendingTasksDiff: -6 } };
}

export function buildTimeSeries() {
  return [
    { date: "1 May", acceptedValue: 22000, confirmedRevenue: 12000, estimatedProfit: 3900, budgetsSent: 5, budgetsAccepted: 2 },
    { date: "8 May", acceptedValue: 91000, confirmedRevenue: 52000, estimatedProfit: 17400, budgetsSent: 14, budgetsAccepted: 8 },
    { date: "15 May", acceptedValue: 158000, confirmedRevenue: 92000, estimatedProfit: 31800, budgetsSent: 24, budgetsAccepted: 14 },
    { date: "22 May", acceptedValue: 226000, confirmedRevenue: 142000, estimatedProfit: 48200, budgetsSent: 38, budgetsAccepted: 23 },
    { date: "31 May", acceptedValue: 248700, confirmedRevenue: 186340, estimatedProfit: 53180, budgetsSent: 64, budgetsAccepted: 32 },
  ];
}

export function buildFunnel() {
  const steps = [
    { key: "leads", label: "Leads", count: 142 },
    { key: "calls_done", label: "Llamadas realizadas", count: 98 },
    { key: "budgets_sent", label: "Presupuestos enviados", count: 64 },
    { key: "budgets_accepted", label: "Presupuestos aceptados", count: 32 },
    { key: "contracts_signed", label: "Contratos firmados", count: 28 },
    { key: "payments_confirmed", label: "Pagos confirmados", count: 26 },
  ];
  return steps.map((step, index) => { const previous = index === 0 ? step.count : steps[index - 1].count; return { ...step, conversionFromPreviousPct: previous > 0 ? (step.count / previous) * 100 : 0, conversionFromLeadPct: steps[0].count > 0 ? (step.count / steps[0].count) * 100 : 0, dropOffCount: Math.max(0, previous - step.count) }; });
}

export function buildDestinationValue() {
  return [
    { destination: "Japón", value: 68400, sharePct: 27.5, cases: 8, marginPct: 22.8 },
    { destination: "Islandia", value: 42600, sharePct: 17.1, cases: 5, marginPct: 20.4 },
    { destination: "Maldivas", value: 36800, sharePct: 14.8, cases: 4, marginPct: 23.4 },
    { destination: "Tanzania", value: 29100, sharePct: 11.7, cases: 3, marginPct: 18.3 },
    { destination: "Perú", value: 24300, sharePct: 9.8, cases: 3, marginPct: 16.1 },
    { destination: "Otros", value: 47500, sharePct: 19.1, cases: 9, marginPct: 19.5 },
  ];
}

export function buildTimingMetrics() {
  return [
    { key: "call_to_budget", label: "Tiempo crear presupuesto", averageDays: 3.1, medianDays: 2.5, p90Days: 7.2, targetDays: 2, status: "warning", affectedCases: 8, drilldownUrl: reportDrilldownUrl("cases", { pain: "budget_creation_delay" }) },
    { key: "budget_to_sent", label: "Tiempo enviar presupuesto", averageDays: 2.8, medianDays: 2.1, p90Days: 5.4, targetDays: 2, status: "warning", affectedCases: 6, drilldownUrl: reportDrilldownUrl("budgets", { pain: "send_delay" }) },
    { key: "sent_to_accepted", label: "Tiempo cliente aceptación", averageDays: 6.4, medianDays: 5.0, p90Days: 12.0, targetDays: 5, status: "bad", affectedCases: 14, drilldownUrl: reportDrilldownUrl("budgets", { status: "sent" }) },
    { key: "cycle_total", label: "Tiempo total ciclo", averageDays: 22.8, medianDays: 19.4, p90Days: 38.1, targetDays: 25, status: "good", affectedCases: 4, drilldownUrl: reportDrilldownUrl("cases", { metric: "cycle_total" }) },
  ];
}

export function buildPainPoints() {
  return [
    { key: "sent_without_followup", title: "Presupuestos enviados sin seguimiento (>7 días)", count: 14, economicImpact: 42800, severity: "high" as PainSeverity, actionLabel: "Crear tareas de seguimiento", drilldownUrl: reportDrilldownUrl("budgets", { pain: "sent_without_followup" }) },
    { key: "supplier_pending", title: "Compras proveedor pendientes de factura (>10 días)", count: 11, economicImpact: demoExpectedPurchases.filter((item) => !isPurchaseClosed(item)).reduce((sum, item) => sum + item.expectedAmount, 0), severity: "high" as PainSeverity, actionLabel: "Abrir compras bloqueadas", drilldownUrl: reportDrilldownUrl("purchases", { blocksCaseClosing: true }) },
    { key: "documentation_pending", title: "Documentación viajeros pendiente (>5 días)", count: 9, severity: "medium" as PainSeverity, actionLabel: "Abrir viajeros", drilldownUrl: "/viajeros?status=pending" },
    { key: "contracts_pending", title: "Contratos pendientes de firma (>7 días)", count: 8, severity: "medium" as PainSeverity, actionLabel: "Abrir contratos", drilldownUrl: "/contratos?status=pending" },
    { key: "payments_pending", title: "Pagos pendientes de confirmar (>3 días)", count: 6, severity: "medium" as PainSeverity, actionLabel: "Abrir pagos", drilldownUrl: "/contratos?payment=pending" },
  ];
}

export function buildProfitabilityRows() {
  return demoBudgets.slice(0, 6).map((budget) => {
    const realCost = budget.realCost || Math.round(budget.totalCostBudget * (budget.status === "accepted" ? 0.98 : 1));
    const realProfit = budget.totalSalePrice - realCost;
    return { caseId: budget.caseCode, caseCode: budget.caseCode, clientName: budget.clientName, destination: budget.destination, salePrice: budget.totalSalePrice, budgetedCost: budget.totalCostBudget, realCost, expectedProfit: budget.expectedProfit, realProfit, expectedMarginPct: budget.expectedMarginPct, realMarginPct: budget.totalSalePrice > 0 ? (realProfit / budget.totalSalePrice) * 100 : 0, costDeviation: realCost - budget.totalCostBudget, status: budget.status };
  });
}

export function buildTeamReport() {
  return [
    { userId: "maria", userName: "María Gómez", activeCases: 12, budgetsCreated: 18, budgetsSent: 16, budgetsAccepted: 9, completedTasks: 32, overdueTasks: 2, acceptedValue: 68400, averageMarginPct: 23.2, averageBudgetCreationDays: 2.4 },
    { userId: "carlos", userName: "Carlos Ruiz", activeCases: 9, budgetsCreated: 14, budgetsSent: 12, budgetsAccepted: 7, completedTasks: 28, overdueTasks: 4, acceptedValue: 45700, averageMarginPct: 19.8, averageBudgetCreationDays: 3.0 },
    { userId: "laura", userName: "Laura Sánchez", activeCases: 11, budgetsCreated: 16, budgetsSent: 15, budgetsAccepted: 6, completedTasks: 24, overdueTasks: 5, acceptedValue: 39200, averageMarginPct: 18.6, averageBudgetCreationDays: 3.8 },
    { userId: "juan", userName: "Juan Pérez", activeCases: 8, budgetsCreated: 12, budgetsSent: 10, budgetsAccepted: 5, completedTasks: 19, overdueTasks: 3, acceptedValue: 31900, averageMarginPct: 21.0, averageBudgetCreationDays: 2.9 },
  ];
}

export function buildSupplierReport() {
  return demoExpectedPurchases.reduce((acc, item) => {
    const existing = acc.find((row) => row.providerName === item.providerName);
    const pending = isPurchaseClosed(item) ? 0 : 1;
    if (existing) { existing.expected += 1; existing.pending += pending; existing.pendingValue += pending ? item.expectedAmount : 0; existing.incidents += item.status === "review_needed" ? 1 : 0; return acc; }
    acc.push({ providerName: item.providerName, expected: 1, received: isPurchaseClosed(item) ? 1 : 0, pending, incidents: item.status === "review_needed" ? 1 : 0, pendingValue: pending ? item.expectedAmount : 0, averageDelayDays: item.status === "expected" ? 12 : 4 });
    return acc;
  }, [] as { providerName: string; expected: number; received: number; pending: number; incidents: number; pendingValue: number; averageDelayDays: number }[]);
}

export function buildClientReport() {
  return demoClientMasters.map((client) => ({ clientId: client.id, clientName: client.display_name, origin: client.origin, activeCases: client.active_cases, acceptedValue: client.accepted_value, acceptedProposals: client.accepted_proposals, fiscalValidated: client.fiscal_validated, duplicateStatus: client.duplicate_status }));
}

export function buildReportPayload() { return { summary: reportSummary(), timeSeries: buildTimeSeries(), funnel: buildFunnel(), destinations: buildDestinationValue(), timing: buildTimingMetrics(), painPoints: buildPainPoints(), profitability: buildProfitabilityRows(), team: buildTeamReport(), suppliers: buildSupplierReport(), clients: buildClientReport(), filters: defaultReportFilters, tabs: reportTabs }; }
