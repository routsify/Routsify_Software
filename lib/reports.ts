export type FunnelStage = {
  stage: string;
  count: number;
  conversion_from_previous: number;
};

export type SourceReport = {
  source: string;
  leads: number;
  calls: number;
  proposals_sent: number;
  proposals_accepted: number;
  accepted_value: number;
};

export type MarginReport = {
  case_code: string;
  client: string;
  destination: string;
  sale: number;
  budget_cost: number;
  real_cost: number;
  budget_profit: number;
  real_profit: number;
};

export type SupplierIssue = {
  supplier: string;
  destination: string;
  open_items: number;
  average_delay_days: number;
  reason: string;
};

export const funnelReport: FunnelStage[] = [
  { stage: "lead", count: 18, conversion_from_previous: 1 },
  { stage: "call_booked", count: 12, conversion_from_previous: 0.67 },
  { stage: "proposal_sent", count: 7, conversion_from_previous: 0.58 },
  { stage: "proposal_accepted", count: 3, conversion_from_previous: 0.43 },
  { stage: "contract_signed", count: 2, conversion_from_previous: 0.67 },
  { stage: "payment_confirmed", count: 2, conversion_from_previous: 1 },
];

export const sourceReports: SourceReport[] = [
  { source: "fillout", leads: 9, calls: 6, proposals_sent: 4, proposals_accepted: 2, accepted_value: 16400 },
  { source: "booking_api", leads: 5, calls: 4, proposals_sent: 2, proposals_accepted: 1, accepted_value: 7200 },
  { source: "manual", leads: 4, calls: 2, proposals_sent: 1, proposals_accepted: 0, accepted_value: 0 },
];

export const marginReports: MarginReport[] = [
  { case_code: "EXP-2026-0001", client: "Laura Martín", destination: "Japón", sale: 7200, budget_cost: 4500, real_cost: 0, budget_profit: 2700, real_profit: 0 },
  { case_code: "EXP-2026-0002", client: "Carlos y Ana Vega", destination: "Costa Rica", sale: 9200, budget_cost: 6100, real_cost: 5800, budget_profit: 3100, real_profit: 3400 },
];

export const supplierIssues: SupplierIssue[] = [
  { supplier: "Hotel Aurora Kyoto", destination: "Japón", open_items: 1, average_delay_days: 4, reason: "Factura pendiente" },
  { supplier: "Operador Selva Verde", destination: "Costa Rica", open_items: 1, average_delay_days: 2, reason: "Documento en revisión" },
];

export function reportSummary() {
  const totalLeads = sourceReports.reduce((sum, item) => sum + item.leads, 0);
  const totalAccepted = sourceReports.reduce((sum, item) => sum + item.proposals_accepted, 0);
  const acceptedValue = sourceReports.reduce((sum, item) => sum + item.accepted_value, 0);
  const budgetProfit = marginReports.reduce((sum, item) => sum + item.budget_profit, 0);
  const realProfit = marginReports.reduce((sum, item) => sum + item.real_profit, 0);
  const openSupplierItems = supplierIssues.reduce((sum, item) => sum + item.open_items, 0);
  return { totalLeads, totalAccepted, acceptedValue, budgetProfit, realProfit, openSupplierItems };
}

export function formatReportMoney(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function formatReportPercent(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 0 }).format(value);
}
