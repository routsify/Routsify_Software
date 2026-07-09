import { demoBudgets } from "@/lib/budget-master";
import { demoClientMasters } from "@/lib/client-master";
import { demoExpedientes } from "@/lib/case-master";
import { demoExpectedPurchases, isPurchaseClosed } from "@/lib/purchase-master";

export const reportTabs = ["Resumen ejecutivo", "Económicos", "Presupuestos", "Clientes", "Tiempos y productividad", "Proveedores", "Rentabilidad", "Equipo"] as const;
export type ReportTabLabel = typeof reportTabs[number];

export const filters = {
  responsible: ["Todos", "Laura Pérez", "Diego Romero", "Sofía Martínez", "Carlos Vega"],
  origin: ["Todos", "Web", "Fillout", "Booking", "Referral", "Agencia", "Instagram", "WhatsApp"],
  destination: ["Todos", "Japón", "Islandia", "Maldivas", "Tanzania", "Perú", "Italia", "Egipto"],
  caseStatus: ["Todos", "Nuevo", "Presupuesto enviado", "Aceptado", "Firmado", "Pagado", "Cerrado"],
  provider: ["Todos", ...Array.from(new Set(demoExpectedPurchases.map((item) => item.providerName)))],
  serviceType: ["Todos", "Vuelo", "Hotel", "Traslado", "Actividad", "Seguro", "Fee"],
  margin: ["Todos", "Bajo", "Medio", "Alto"],
};

export function money(value: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
export function percent(value: number) { return `${value.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; }

export function reportUrl(base: string, params: Record<string, string | number | boolean>) { const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])); return `${base}?${query.toString()}`; }

export function summaryMetrics() {
  const accepted = demoBudgets.filter((budget) => budget.status === "accepted" || budget.status === "sent");
  const acceptedValue = accepted.reduce((sum, budget) => sum + budget.totalSalePrice, 0);
  const confirmedRevenue = demoExpedientes.filter((item) => item.paymentStatus === "confirmed").reduce((sum, item) => sum + item.acceptedValue, 0);
  const budgetedCost = accepted.reduce((sum, budget) => sum + budget.totalCostBudget, 0);
  const realCost = accepted.reduce((sum, budget) => sum + (budget.realCost || budget.totalCostBudget), 0);
  const estimatedProfit = acceptedValue - budgetedCost;
  const realProfit = acceptedValue - realCost;
  return {
    acceptedValue,
    confirmedRevenue,
    averageMarginPct: acceptedValue ? (estimatedProfit / acceptedValue) * 100 : 0,
    realMarginPct: acceptedValue ? (realProfit / acceptedValue) * 100 : 0,
    estimatedProfit,
    realProfit,
    activeCases: demoExpedientes.filter((item) => item.status !== "cerrado").length,
    pendingTasks: painPoints().reduce((sum, point) => sum + point.count, 0),
    budgetedCost,
    realCost,
    costDeviation: realCost - budgetedCost,
    pendingCollection: acceptedValue - confirmedRevenue,
  };
}

export function timeSeries() { return [
  { date: "1 May", acceptedValue: 22000, confirmedRevenue: 12000, estimatedProfit: 3900, realProfit: 3600, budgetsSent: 5, budgetsAccepted: 2 },
  { date: "8 May", acceptedValue: 91000, confirmedRevenue: 52000, estimatedProfit: 17400, realProfit: 16900, budgetsSent: 14, budgetsAccepted: 8 },
  { date: "15 May", acceptedValue: 158000, confirmedRevenue: 92000, estimatedProfit: 31800, realProfit: 30600, budgetsSent: 24, budgetsAccepted: 14 },
  { date: "22 May", acceptedValue: 226000, confirmedRevenue: 142000, estimatedProfit: 48200, realProfit: 47100, budgetsSent: 38, budgetsAccepted: 23 },
  { date: "31 May", acceptedValue: 248700, confirmedRevenue: 186340, estimatedProfit: 53180, realProfit: 52060, budgetsSent: 64, budgetsAccepted: 32 },
]; }

export function funnelSteps() { const steps = [
  { key: "leads", label: "Leads recibidos", count: 142, url: "/clientes?origin=all" },
  { key: "calls", label: "Llamadas realizadas", count: 98, url: "/expedientes?stage=call_done" },
  { key: "budgets_sent", label: "Presupuestos enviados", count: 64, url: "/propuestas?status=sent" },
  { key: "budgets_accepted", label: "Presupuestos aceptados", count: 32, url: "/propuestas?status=accepted" },
  { key: "contracts_signed", label: "Contratos firmados", count: 28, url: "/contratos?status=signed" },
  { key: "payments_confirmed", label: "Pagos confirmados", count: 26, url: "/contratos?payment=confirmed" },
]; return steps.map((step, index) => { const prev = index ? steps[index - 1].count : step.count; return { ...step, conversionFromPreviousPct: prev ? (step.count / prev) * 100 : 0, conversionFromLeadPct: steps[0].count ? (step.count / steps[0].count) * 100 : 0, dropOffCount: Math.max(0, prev - step.count) }; }); }

export function destinations() { return [
  { destination: "Japón", value: 68400, sharePct: 27.5, cases: 8, ticketAvg: 8550, marginPct: 22.8, realMarginPct: 21.9 },
  { destination: "Islandia", value: 42600, sharePct: 17.1, cases: 5, ticketAvg: 8520, marginPct: 20.4, realMarginPct: 19.6 },
  { destination: "Maldivas", value: 36800, sharePct: 14.8, cases: 4, ticketAvg: 9200, marginPct: 23.4, realMarginPct: 22.3 },
  { destination: "Tanzania", value: 29100, sharePct: 11.7, cases: 3, ticketAvg: 9700, marginPct: 18.3, realMarginPct: 17.1 },
  { destination: "Perú", value: 24300, sharePct: 9.8, cases: 3, ticketAvg: 8100, marginPct: 16.1, realMarginPct: 15.2 },
  { destination: "Otros", value: 47500, sharePct: 19.1, cases: 9, ticketAvg: 5278, marginPct: 19.5, realMarginPct: 18.8 },
]; }

export function timingMetrics() { return [
  { key: "lead_to_call", label: "Lead → llamada", averageDays: 1.2, medianDays: 1.0, p90Days: 3.2, targetDays: 2, status: "good", affectedCases: 2, url: "/expedientes?pain=lead_call_delay" },
  { key: "call_to_budget", label: "Tiempo crear presupuesto", averageDays: 3.1, medianDays: 2.5, p90Days: 7.2, targetDays: 2, status: "warning", affectedCases: 8, url: "/expedientes?pain=budget_creation_delay" },
  { key: "budget_to_sent", label: "Tiempo enviar presupuesto", averageDays: 2.8, medianDays: 2.1, p90Days: 5.4, targetDays: 2, status: "warning", affectedCases: 6, url: "/propuestas?pain=send_delay" },
  { key: "sent_to_accepted", label: "Tiempo cliente aceptación", averageDays: 6.4, medianDays: 5.0, p90Days: 12.0, targetDays: 5, status: "bad", affectedCases: 14, url: "/propuestas?status=sent" },
  { key: "contract_to_payment", label: "Firma → pago", averageDays: 7.3, medianDays: 5.7, p90Days: 13.8, targetDays: 5, status: "bad", affectedCases: 6, url: "/contratos?payment=pending" },
  { key: "cycle_total", label: "Tiempo total ciclo", averageDays: 22.8, medianDays: 19.4, p90Days: 38.1, targetDays: 25, status: "good", affectedCases: 4, url: "/expedientes?metric=cycle_total" },
]; }

export function painPoints() { return [
  { key: "sent_without_followup", title: "Presupuestos enviados sin seguimiento (>7 días)", count: 14, economicImpact: 42800, severity: "high", actionLabel: "Crear tareas", url: "/propuestas?pain=sent_without_followup" },
  { key: "supplier_pending", title: "Compras proveedor pendientes de factura (>10 días)", count: 11, economicImpact: demoExpectedPurchases.filter((item) => !isPurchaseClosed(item)).reduce((sum, item) => sum + item.expectedAmount, 0), severity: "high", actionLabel: "Abrir compras", url: "/compras?blocksCaseClosing=true" },
  { key: "documentation_pending", title: "Documentación viajeros pendiente (>5 días)", count: 9, severity: "medium", actionLabel: "Abrir viajeros", url: "/viajeros?status=pending" },
  { key: "contracts_pending", title: "Contratos pendientes de firma (>7 días)", count: 8, severity: "medium", actionLabel: "Abrir contratos", url: "/contratos?status=pending" },
  { key: "payments_pending", title: "Pagos pendientes de confirmar (>3 días)", count: 6, severity: "medium", actionLabel: "Abrir pagos", url: "/contratos?payment=pending" },
  { key: "holded_errors", title: "Errores Holded pendientes", count: 3, economicImpact: 24700, severity: "high", actionLabel: "Reintentar sync", url: "/ajustes?tab=integrations" },
] as const; }

export function profitabilityRows() { return demoBudgets.map((budget) => { const realCost = budget.realCost || Math.round(budget.totalCostBudget * (budget.status === "accepted" ? 0.98 : 1)); const realProfit = budget.totalSalePrice - realCost; return { caseCode: budget.caseCode, clientName: budget.clientName, destination: budget.destination, salePrice: budget.totalSalePrice, budgetedCost: budget.totalCostBudget, realCost, expectedProfit: budget.expectedProfit, realProfit, expectedMarginPct: budget.expectedMarginPct, realMarginPct: budget.totalSalePrice ? (realProfit / budget.totalSalePrice) * 100 : 0, costDeviation: realCost - budget.totalCostBudget, status: budget.status }; }); }

export function supplierRows() { return demoExpectedPurchases.reduce((acc, item) => { const row = acc.find((entry) => entry.providerName === item.providerName); const pending = isPurchaseClosed(item) ? 0 : 1; const deviation = (item.holdedAmount || item.expectedAmount) - item.expectedAmount; if (row) { row.expected += 1; row.pending += pending; row.pendingValue += pending ? item.expectedAmount : 0; row.incidents += item.status === "review_needed" ? 1 : 0; row.costDeviation += deviation; row.blockedCases += item.blocksCaseClosing ? 1 : 0; return acc; } acc.push({ providerName: item.providerName, expected: 1, received: isPurchaseClosed(item) ? 1 : 0, pending, incidents: item.status === "review_needed" ? 1 : 0, pendingValue: pending ? item.expectedAmount : 0, averageDelayDays: item.status === "expected" ? 12 : 4, costDeviation: deviation, blockedCases: item.blocksCaseClosing ? 1 : 0 }); return acc; }, [] as { providerName: string; expected: number; received: number; pending: number; incidents: number; pendingValue: number; averageDelayDays: number; costDeviation: number; blockedCases: number }[]); }

export function clientRows() { return demoClientMasters.map((client) => ({ clientId: client.id, clientName: client.display_name, origin: client.origin, activeCases: client.active_cases, acceptedValue: client.accepted_value, acceptedProposals: client.accepted_proposals, fiscalValidated: client.fiscal_validated, duplicateStatus: client.duplicate_status, ticketAvg: client.accepted_proposals > 0 ? client.accepted_value / client.accepted_proposals : 0 })); }
export function budgetRows() { return demoBudgets.map((budget) => ({ code: budget.code, clientName: budget.clientName, caseCode: budget.caseCode, status: budget.status, responsibleName: budget.responsibleName, totalSalePrice: budget.totalSalePrice, marginPct: budget.expectedMarginPct, createdDays: 3.1, sendDays: budget.status === "draft" ? 0 : 2.8, acceptDays: budget.status === "accepted" ? 6.4 : 0, lowMargin: budget.expectedMarginPct < 16 })); }
export function teamRows() { return [
  { userId: "maria", userName: "María Gómez", activeCases: 12, budgetsCreated: 18, budgetsSent: 16, budgetsAccepted: 9, completedTasks: 32, overdueTasks: 2, acceptedValue: 68400, averageMarginPct: 23.2, averageBudgetCreationDays: 2.4, blockers: 3 },
  { userId: "carlos", userName: "Carlos Ruiz", activeCases: 9, budgetsCreated: 14, budgetsSent: 12, budgetsAccepted: 7, completedTasks: 28, overdueTasks: 4, acceptedValue: 45700, averageMarginPct: 19.8, averageBudgetCreationDays: 3.0, blockers: 5 },
  { userId: "laura", userName: "Laura Sánchez", activeCases: 11, budgetsCreated: 16, budgetsSent: 15, budgetsAccepted: 6, completedTasks: 24, overdueTasks: 5, acceptedValue: 39200, averageMarginPct: 18.6, averageBudgetCreationDays: 3.8, blockers: 6 },
  { userId: "juan", userName: "Juan Pérez", activeCases: 8, budgetsCreated: 12, budgetsSent: 10, budgetsAccepted: 5, completedTasks: 19, overdueTasks: 3, acceptedValue: 31900, averageMarginPct: 21.0, averageBudgetCreationDays: 2.9, blockers: 2 },
]; }

export function reportPayload() { return { summary: summaryMetrics(), timeSeries: timeSeries(), funnel: funnelSteps(), destinations: destinations(), timing: timingMetrics(), painPoints: painPoints(), profitability: profitabilityRows(), suppliers: supplierRows(), clients: clientRows(), budgets: budgetRows(), team: teamRows(), filters }; }
