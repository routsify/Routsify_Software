import { budgetLines, cases, clients, expectedPurchases } from "@/lib/mock-data";
import { calculateBudgetTotals } from "@/lib/budget";
import { demoBillingDocuments, demoPayments } from "@/lib/billing";
import { demoContracts } from "@/lib/contracts";
import { demoRequests } from "@/lib/requests";

export type FunnelStage = {
  stage: string;
  count: number;
  conversion_from_previous: number;
  next_action: string;
};

export type SourceReport = {
  source: string;
  leads: number;
  calls: number;
  proposals_sent: number;
  proposals_accepted: number;
  accepted_value: number;
  conversion_rate: number;
};

export type MarginReport = {
  case_code: string;
  client: string;
  destination: string;
  sale: number;
  budget_cost: number;
  expected_purchase_cost: number;
  real_cost: number;
  budget_profit: number;
  real_profit: number;
  deviation: number;
  margin_expected: number;
  margin_real: number;
};

export type SupplierIssue = {
  supplier: string;
  destination: string;
  case_code: string;
  open_items: number;
  amount: number;
  status: string;
  reason: string;
  action: string;
};

export type StageTimingReport = {
  case_code: string;
  client: string;
  current_stage: string;
  days_until_trip: number;
  health: "ok" | "watch" | "blocked";
  next_action: string;
};

function conversion(count: number, previous: number) {
  if (previous <= 0) return count > 0 ? 1 : 0;
  return count / previous;
}

function isAccepted(caseStatus: string, acceptedValue: number) {
  return acceptedValue > 0 || ["proposal_accepted", "contract_ready", "contract_signed", "payment_confirmed", "suppliers_pending", "ready_to_close", "closed"].includes(caseStatus);
}

function receivedForCase(caseCode: string) {
  return demoPayments.filter((payment) => payment.case_code === caseCode && payment.status === "received").reduce((sum, payment) => sum + payment.amount, 0);
}

function expectedCostForCase(caseCode: string) {
  return expectedPurchases.filter((purchase) => purchase.case_code === caseCode).reduce((sum, purchase) => sum + purchase.amount, 0);
}

export function buildFunnelReport(): FunnelStage[] {
  const lead = demoRequests.length;
  const qualified = demoRequests.filter((item) => item.status === "qualified" || item.status === "call_scheduled" || item.status === "converted").length;
  const proposalSent = cases.filter((item) => item.status === "proposal_sent" || isAccepted(item.status, item.accepted_value)).length;
  const accepted = cases.filter((item) => isAccepted(item.status, item.accepted_value)).length;
  const signed = demoContracts.filter((item) => item.status === "signed").length;
  const paid = cases.filter((item) => item.accepted_value > 0 && receivedForCase(item.case_code) >= item.accepted_value).length;

  return [
    { stage: "lead", count: lead, conversion_from_previous: 1, next_action: "Cualificar origen y evitar duplicados." },
    { stage: "qualified_or_call", count: qualified, conversion_from_previous: conversion(qualified, lead), next_action: "Agendar llamada o convertir si hay encaje." },
    { stage: "proposal_sent", count: proposalSent, conversion_from_previous: conversion(proposalSent, qualified), next_action: "Seguimiento comercial y control de versión." },
    { stage: "proposal_accepted", count: accepted, conversion_from_previous: conversion(accepted, proposalSent), next_action: "Bloquear versión, contrato y pago." },
    { stage: "contract_signed", count: signed, conversion_from_previous: conversion(signed, accepted), next_action: "Confirmar pago y compras proveedor." },
    { stage: "payment_confirmed", count: paid, conversion_from_previous: conversion(paid, signed), next_action: "Preparar cierre operativo." },
  ];
}

export function buildSourceReports(): SourceReport[] {
  const sources = Array.from(new Set([...demoRequests.map((item) => item.source), ...clients.map((item) => item.source || "manual")]));
  return sources.map((source) => {
    const sourceRequests = demoRequests.filter((item) => item.source === source);
    const sourceClients = clients.filter((client) => (client.source || "manual") === source);
    const clientNames = new Set(sourceClients.map((client) => client.display_name));
    const sourceCases = cases.filter((item) => clientNames.has(item.client));
    const proposalsSent = sourceCases.filter((item) => item.status === "proposal_sent" || isAccepted(item.status, item.accepted_value)).length;
    const acceptedCases = sourceCases.filter((item) => isAccepted(item.status, item.accepted_value));
    const leads = sourceRequests.length + sourceClients.length;
    const acceptedValue = acceptedCases.reduce((sum, item) => sum + item.accepted_value, 0);
    return {
      source,
      leads,
      calls: sourceRequests.filter((item) => item.status === "qualified" || item.status === "call_scheduled").length,
      proposals_sent: proposalsSent,
      proposals_accepted: acceptedCases.length,
      accepted_value: acceptedValue,
      conversion_rate: leads > 0 ? acceptedCases.length / leads : 0,
    };
  });
}

export function buildMarginReports(): MarginReport[] {
  const japanBudget = calculateBudgetTotals(budgetLines);
  return cases.map((item) => {
    const expectedPurchaseCost = expectedCostForCase(item.case_code);
    const sale = item.accepted_value || (item.case_code === "EXP-2026-0001" ? japanBudget.totalSale : 0);
    const budgetCost = item.case_code === "EXP-2026-0001" ? japanBudget.totalCost : expectedPurchaseCost;
    const realCost = expectedPurchases.filter((purchase) => purchase.case_code === item.case_code && purchase.status === "approved").reduce((sum, purchase) => sum + purchase.amount, 0);
    const budgetProfit = sale - budgetCost;
    const realProfit = realCost > 0 ? sale - realCost : 0;
    const marginExpected = sale > 0 ? budgetProfit / sale : 0;
    const marginReal = sale > 0 && realCost > 0 ? realProfit / sale : 0;
    return {
      case_code: item.case_code,
      client: item.client,
      destination: item.destination,
      sale,
      budget_cost: budgetCost,
      expected_purchase_cost: expectedPurchaseCost,
      real_cost: realCost,
      budget_profit: budgetProfit,
      real_profit: realProfit,
      deviation: realCost > 0 ? realProfit - budgetProfit : 0,
      margin_expected: marginExpected,
      margin_real: marginReal,
    };
  });
}

export function buildSupplierIssues(): SupplierIssue[] {
  return expectedPurchases
    .filter((purchase) => purchase.status !== "approved" && purchase.status !== "not_required" && purchase.status !== "cancelled")
    .map((purchase) => {
      const caseData = cases.find((item) => item.case_code === purchase.case_code);
      const reason = purchase.status === "expected" ? "Compra esperada sin solicitud cerrada" : purchase.status === "requested" ? "Proveedor solicitado, falta cierre" : "Revisión pendiente";
      return {
        supplier: purchase.supplier,
        destination: caseData?.destination || "—",
        case_code: purchase.case_code,
        open_items: 1,
        amount: purchase.amount,
        status: purchase.status,
        reason,
        action: "Cerrar factura proveedor, revisar diferencia o justificar excepción.",
      };
    });
}

export function buildStageTimings(): StageTimingReport[] {
  const today = new Date();
  return cases.map((item) => {
    const tripStart = new Date(item.trip_start);
    const daysUntilTrip = Number.isNaN(tripStart.getTime()) ? 0 : Math.ceil((tripStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const fiscalBlocked = demoBillingDocuments.some((document) => document.case_code === item.case_code && (document.status === "blocked" || document.status === "error"));
    const purchaseOpen = expectedPurchases.some((purchase) => purchase.case_code === item.case_code && purchase.status !== "approved" && purchase.status !== "not_required" && purchase.status !== "cancelled");
    const health = item.blocker || fiscalBlocked ? "blocked" : purchaseOpen || daysUntilTrip < 60 ? "watch" : "ok";
    return {
      case_code: item.case_code,
      client: item.client,
      current_stage: item.status,
      days_until_trip: daysUntilTrip,
      health,
      next_action: item.next_action || (health === "ok" ? "Mantener seguimiento" : "Revisar bloqueos operativos"),
    };
  });
}

export const funnelReport = buildFunnelReport();
export const sourceReports = buildSourceReports();
export const marginReports = buildMarginReports();
export const supplierIssues = buildSupplierIssues();
export const stageTimingReports = buildStageTimings();

export function reportSummary() {
  const sources = buildSourceReports();
  const margins = buildMarginReports();
  const issues = buildSupplierIssues();
  const timings = buildStageTimings();
  const totalLeads = sources.reduce((sum, item) => sum + item.leads, 0);
  const totalAccepted = sources.reduce((sum, item) => sum + item.proposals_accepted, 0);
  const acceptedValue = sources.reduce((sum, item) => sum + item.accepted_value, 0);
  const budgetProfit = margins.reduce((sum, item) => sum + item.budget_profit, 0);
  const realProfit = margins.reduce((sum, item) => sum + item.real_profit, 0);
  const openSupplierItems = issues.reduce((sum, item) => sum + item.open_items, 0);
  const blockedCases = timings.filter((item) => item.health === "blocked").length;
  return { totalLeads, totalAccepted, acceptedValue, budgetProfit, realProfit, openSupplierItems, blockedCases };
}

export function formatReportMoney(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function formatReportPercent(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 0 }).format(value);
}
