import { listCaseDirectoryPage } from "@/lib/case-directory-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
export type ReportPeriod = 30 | 90 | 365 | 0;

export type CurrencyFinancials = {
  currency: string;
  acceptedSales: number;
  paid: number;
  outstanding: number;
  budgetCost: number;
  realCost: number;
  budgetProfit: number;
  realProfit: number;
  budgetMargin: number;
  realMargin: number;
  pipeline: number;
};

export type PerformanceRow = {
  key: string;
  label: string;
  leads?: number;
  cases?: number;
  accepted?: number;
  purchases?: number;
  pending?: number;
  sale?: number;
  cost?: number;
  profit?: number;
  margin?: number;
  conversion?: number;
  deviation?: number;
};

export type MonthlyTrend = {
  month: string;
  label: string;
  leads: number;
  cases: number;
  acceptedSales: number;
  payments: number;
};

export type BusinessIntelligenceData = {
  period: ReportPeriod;
  periodLabel: string;
  generatedAt: string;
  counts: {
    clients: number;
    leads: number;
    callsBooked: number;
    cases: number;
    acceptedCases: number;
    activeCases: number;
    closedCases: number;
    proposals: number;
    acceptedProposals: number;
    suppliers: number;
  };
  conversion: {
    leadToCall: number;
    leadToCase: number;
    caseToAccepted: number;
    proposalToAccepted: number;
  };
  timing: {
    leadToCaseHours: number | null;
    caseToProposalHours: number | null;
    proposalToAcceptanceHours: number | null;
    caseToCloseDays: number | null;
  };
  taskHealth: {
    open: number;
    overdue: number;
    blocked: number;
    done: number;
    completionRate: number;
  };
  caseHealth: {
    critical: number;
    attention: number;
    blocked: number;
    upcoming30: number;
  };
  financials: CurrencyFinancials[];
  sources: PerformanceRow[];
  destinations: PerformanceRow[];
  suppliers: PerformanceRow[];
  monthly: MonthlyTrend[];
};

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function one(value: unknown): Row | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as Row : null;
  return value && typeof value === "object" ? value as Row : null;
}
function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item): item is Row => Boolean(item && typeof item === "object"));
  const item = one(value); return item ? [item] : [];
}
function percentage(numerator: number, denominator: number) { return denominator > 0 ? numerator / denominator * 100 : 0; }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function timestamp(value: unknown) { const parsed = value ? new Date(String(value)).getTime() : NaN; return Number.isFinite(parsed) ? parsed : null; }
function hoursBetween(left: unknown, right: unknown) { const start = timestamp(left); const end = timestamp(right); return start !== null && end !== null && end >= start ? (end - start) / 3_600_000 : null; }
function daysBetween(left: unknown, right: unknown) { const hours = hoursBetween(left, right); return hours === null ? null : hours / 24; }
function periodStart(period: ReportPeriod) { return period === 0 ? null : new Date(Date.now() - period * 86_400_000).toISOString(); }
function inPeriod(row: Row, start: string | null, field = "created_at") { return !start || text(row[field]) >= start; }
function periodLabel(period: ReportPeriod) { return period === 30 ? "Últimos 30 días" : period === 90 ? "Últimos 90 días" : period === 365 ? "Últimos 12 meses" : "Todo el histórico"; }
function normalizePeriod(value?: number): ReportPeriod { return value === 30 || value === 90 || value === 0 ? value : 365; }
function currency(value: unknown) { return text(value).toUpperCase() || "EUR"; }
function monthKey(value: unknown) { const date = value ? new Date(String(value)) : null; return date && Number.isFinite(date.getTime()) ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` : ""; }
function monthLabel(key: string) { const [year, month] = key.split("-").map(Number); return new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1))); }
function normalizeDestination(value: unknown) { return text(value).trim() || "Sin destino"; }
function proposalVersion(proposal: Row) {
  const versions = rows(proposal.proposal_versions);
  const currentId = text(proposal.current_version_id);
  return versions.find((item) => text(item.id) === currentId) || [...versions].sort((a, b) => numberValue(b.version_number) - numberValue(a.version_number))[0] || null;
}

export async function loadBusinessIntelligence(organizationId: string, requestedPeriod?: number): Promise<BusinessIntelligenceData> {
  const period = normalizePeriod(requestedPeriod);
  const start = periodStart(period);
  const db = getSupabaseAdminClient();
  const [clientsResult, leadsResult, bookingsResult, casesResult, proposalsResult, paymentsResult, purchasesResult, suppliersResult, tasksResult] = await Promise.all([
    db.from("clients").select("id,source,created_at").eq("organization_id", organizationId).limit(10_000),
    db.from("leads").select("id,client_id,source,status,destination,created_at,updated_at").eq("organization_id", organizationId).limit(10_000),
    db.from("bookings").select("id,lead_id,client_id,status,starts_at,created_at").eq("organization_id", organizationId).limit(10_000),
    db.from("cases").select("id,lead_id,client_id,status,destination,accepted_value,currency,created_at,updated_at,closed_at,operational_closed_at").eq("organization_id", organizationId).limit(10_000),
    db.from("proposals").select("id,case_id,status,current_version_id,created_at,updated_at,proposal_versions!proposal_versions_proposal_id_fkey(id,version_number,total_sale,total_cost_budget,total_cost_real,budgeted_profit,real_profit,real_margin_pct,accepted_at,created_at)").eq("organization_id", organizationId).limit(10_000),
    db.from("payments").select("id,case_id,status,amount,currency,received_at,confirmed_at,created_at").eq("organization_id", organizationId).limit(10_000),
    db.from("expected_purchases").select("id,case_id,supplier_id,supplier_name,status,expected_amount,approved_cost,invoice_total,currency,created_at,approved_at").eq("organization_id", organizationId).limit(20_000),
    db.from("suppliers").select("id,name,category,active,created_at").eq("organization_id", organizationId).limit(10_000),
    db.from("tasks").select("id,status,priority,due_at,blocker,created_at,updated_at").eq("organization_id", organizationId).limit(20_000),
  ]);
  const firstError = [clientsResult.error, leadsResult.error, bookingsResult.error, casesResult.error, proposalsResult.error, paymentsResult.error, purchasesResult.error, suppliersResult.error, tasksResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const clients = (clientsResult.data || []) as Row[];
  const allLeads = (leadsResult.data || []) as Row[];
  const allBookings = (bookingsResult.data || []) as Row[];
  const allCases = (casesResult.data || []) as Row[];
  const allProposals = (proposalsResult.data || []) as Row[];
  const allPayments = (paymentsResult.data || []) as Row[];
  const allPurchases = (purchasesResult.data || []) as Row[];
  const suppliers = (suppliersResult.data || []) as Row[];
  const allTasks = (tasksResult.data || []) as Row[];

  const leads = allLeads.filter((row) => inPeriod(row, start));
  const bookings = allBookings.filter((row) => inPeriod(row, start));
  const cases = allCases.filter((row) => inPeriod(row, start));
  const proposals = allProposals.filter((row) => inPeriod(row, start));
  const payments = allPayments.filter((row) => inPeriod(row, start, text(row.received_at) ? "received_at" : text(row.confirmed_at) ? "confirmed_at" : "created_at"));
  const purchases = allPurchases.filter((row) => inPeriod(row, start));
  const tasks = allTasks.filter((row) => inPeriod(row, start));
  const caseById = new Map(allCases.map((row) => [text(row.id), row]));
  const leadById = new Map(allLeads.map((row) => [text(row.id), row]));
  const supplierById = new Map(suppliers.map((row) => [text(row.id), row]));

  const acceptedProposals = proposals.filter((row) => text(row.status) === "accepted");
  const acceptedCaseIds = new Set(acceptedProposals.map((row) => text(row.case_id)).filter(Boolean));
  const acceptedCases = cases.filter((row) => acceptedCaseIds.has(text(row.id)) || numberValue(row.accepted_value) > 0);
  const bookedLeadIds = new Set(bookings.filter((row) => !["cancelled", "canceled"].includes(text(row.status).toLowerCase())).map((row) => text(row.lead_id)).filter(Boolean));
  const caseLeadIds = new Set(cases.map((row) => text(row.lead_id)).filter(Boolean));
  const activeCases = cases.filter((row) => text(row.status) !== "closed");
  const closedCases = cases.filter((row) => text(row.status) === "closed");

  const leadToCaseTimes = cases.map((caseRow) => hoursBetween(leadById.get(text(caseRow.lead_id))?.created_at, caseRow.created_at)).filter((value): value is number => value !== null);
  const caseToProposalTimes = proposals.map((proposal) => hoursBetween(caseById.get(text(proposal.case_id))?.created_at, proposal.created_at)).filter((value): value is number => value !== null);
  const proposalAcceptanceTimes = acceptedProposals.map((proposal) => hoursBetween(proposal.created_at, proposalVersion(proposal)?.accepted_at)).filter((value): value is number => value !== null);
  const caseCloseTimes = closedCases.map((caseRow) => daysBetween(caseRow.created_at, caseRow.operational_closed_at || caseRow.closed_at)).filter((value): value is number => value !== null);

  const taskNow = Date.now();
  const openTasks = tasks.filter((row) => ["pending", "in_progress"].includes(text(row.status)));
  const doneTasks = tasks.filter((row) => text(row.status) === "done");
  const overdueTasks = openTasks.filter((row) => { const due = timestamp(row.due_at); return due !== null && due < taskNow; });
  const blockedTasks = openTasks.filter((row) => Boolean(text(row.blocker)));
  const caseHealth = await listCaseDirectoryPage(organizationId, { page: 1, pageSize: 200, status: "active", health: "all" });

  const financialMap = new Map<string, CurrencyFinancials>();
  function finance(code: string) {
    const key = currency(code);
    const existing = financialMap.get(key);
    if (existing) return existing;
    const created: CurrencyFinancials = { currency: key, acceptedSales: 0, paid: 0, outstanding: 0, budgetCost: 0, realCost: 0, budgetProfit: 0, realProfit: 0, budgetMargin: 0, realMargin: 0, pipeline: 0 };
    financialMap.set(key, created); return created;
  }

  for (const proposal of proposals) {
    const caseRow = caseById.get(text(proposal.case_id));
    const version = proposalVersion(proposal);
    const target = finance(currency(caseRow?.currency));
    const sale = numberValue(version?.total_sale);
    if (text(proposal.status) === "accepted") {
      const budgetCost = numberValue(version?.total_cost_budget);
      const realCost = numberValue(version?.total_cost_real) || purchases.filter((item) => text(item.case_id) === text(proposal.case_id) && text(item.status) === "approved").reduce((sum, item) => sum + numberValue(item.approved_cost || item.invoice_total), 0);
      target.acceptedSales += sale;
      target.budgetCost += budgetCost;
      target.realCost += realCost;
      target.budgetProfit += numberValue(version?.budgeted_profit) || sale - budgetCost;
      target.realProfit += numberValue(version?.real_profit) || sale - realCost;
    } else if (!["rejected", "cancelled"].includes(text(proposal.status))) target.pipeline += sale;
  }
  for (const payment of payments) {
    if (["confirmed", "paid", "received"].includes(text(payment.status))) finance(currency(payment.currency || caseById.get(text(payment.case_id))?.currency)).paid += numberValue(payment.amount);
  }
  for (const item of financialMap.values()) {
    item.outstanding = Math.max(0, item.acceptedSales - item.paid);
    item.budgetMargin = percentage(item.budgetProfit, item.acceptedSales);
    item.realMargin = percentage(item.realProfit, item.acceptedSales);
  }

  const sourceMap = new Map<string, PerformanceRow>();
  for (const lead of leads) {
    const label = text(lead.source) || "Sin fuente";
    const current = sourceMap.get(label) || { key: label.toLowerCase(), label, leads: 0, cases: 0, accepted: 0, sale: 0 };
    current.leads = (current.leads || 0) + 1;
    sourceMap.set(label, current);
  }
  for (const caseRow of cases) {
    const lead = leadById.get(text(caseRow.lead_id));
    const label = text(lead?.source) || "Sin fuente";
    const current = sourceMap.get(label) || { key: label.toLowerCase(), label, leads: 0, cases: 0, accepted: 0, sale: 0 };
    current.cases = (current.cases || 0) + 1;
    if (acceptedCaseIds.has(text(caseRow.id)) || numberValue(caseRow.accepted_value) > 0) { current.accepted = (current.accepted || 0) + 1; current.sale = (current.sale || 0) + numberValue(caseRow.accepted_value); }
    sourceMap.set(label, current);
  }
  const sourceRows = [...sourceMap.values()].map((row) => ({ ...row, conversion: percentage(row.accepted || 0, row.leads || 0) })).sort((a, b) => (b.accepted || 0) - (a.accepted || 0) || (b.leads || 0) - (a.leads || 0));

  const destinationMap = new Map<string, PerformanceRow>();
  for (const caseRow of cases) {
    const label = normalizeDestination(caseRow.destination);
    const current = destinationMap.get(label) || { key: label.toLowerCase(), label, cases: 0, accepted: 0, sale: 0, cost: 0, profit: 0 };
    current.cases = (current.cases || 0) + 1;
    if (acceptedCaseIds.has(text(caseRow.id)) || numberValue(caseRow.accepted_value) > 0) {
      current.accepted = (current.accepted || 0) + 1;
      const sale = numberValue(caseRow.accepted_value);
      const realCost = allPurchases.filter((item) => text(item.case_id) === text(caseRow.id) && text(item.status) === "approved").reduce((sum, item) => sum + numberValue(item.approved_cost || item.invoice_total), 0);
      current.sale = (current.sale || 0) + sale; current.cost = (current.cost || 0) + realCost; current.profit = (current.profit || 0) + sale - realCost;
    }
    destinationMap.set(label, current);
  }
  const destinationRows = [...destinationMap.values()].map((row) => ({ ...row, margin: percentage(row.profit || 0, row.sale || 0), conversion: percentage(row.accepted || 0, row.cases || 0) })).sort((a, b) => (b.profit || 0) - (a.profit || 0) || (b.sale || 0) - (a.sale || 0));

  const supplierMap = new Map<string, PerformanceRow>();
  for (const purchase of purchases) {
    const supplier = supplierById.get(text(purchase.supplier_id));
    const label = text(supplier?.name || purchase.supplier_name) || "Proveedor sin asignar";
    const current = supplierMap.get(label) || { key: text(purchase.supplier_id) || label.toLowerCase(), label, purchases: 0, pending: 0, cost: 0, sale: 0, deviation: 0 };
    const expected = numberValue(purchase.expected_amount);
    const real = numberValue(purchase.approved_cost || purchase.invoice_total);
    current.purchases = (current.purchases || 0) + 1;
    if (!["approved", "not_required", "cancelled"].includes(text(purchase.status))) current.pending = (current.pending || 0) + 1;
    current.sale = (current.sale || 0) + expected;
    current.cost = (current.cost || 0) + real;
    current.deviation = (current.deviation || 0) + real - expected;
    supplierMap.set(label, current);
  }
  const supplierRows = [...supplierMap.values()].sort((a, b) => (b.cost || 0) - (a.cost || 0) || (b.purchases || 0) - (a.purchases || 0));

  const monthKeys: string[] = [];
  const now = new Date();
  for (let index = 11; index >= 0; index -= 1) monthKeys.push(`${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1)).getUTCFullYear()}-${String(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1)).getUTCMonth() + 1).padStart(2, "0")}`);
  const monthMap = new Map(monthKeys.map((key) => [key, { month: key, label: monthLabel(key), leads: 0, cases: 0, acceptedSales: 0, payments: 0 } satisfies MonthlyTrend]));
  for (const lead of allLeads) { const item = monthMap.get(monthKey(lead.created_at)); if (item) item.leads += 1; }
  for (const caseRow of allCases) { const item = monthMap.get(monthKey(caseRow.created_at)); if (item) item.cases += 1; }
  for (const proposal of allProposals.filter((row) => text(row.status) === "accepted")) { const version = proposalVersion(proposal); const item = monthMap.get(monthKey(version?.accepted_at || proposal.updated_at)); if (item) item.acceptedSales += numberValue(version?.total_sale); }
  for (const payment of allPayments.filter((row) => ["confirmed", "paid", "received"].includes(text(row.status)))) { const item = monthMap.get(monthKey(payment.received_at || payment.confirmed_at || payment.created_at)); if (item) item.payments += numberValue(payment.amount); }

  return {
    period,
    periodLabel: periodLabel(period),
    generatedAt: new Date().toISOString(),
    counts: { clients: clients.filter((row) => inPeriod(row, start)).length, leads: leads.length, callsBooked: bookedLeadIds.size, cases: cases.length, acceptedCases: acceptedCases.length, activeCases: activeCases.length, closedCases: closedCases.length, proposals: proposals.length, acceptedProposals: acceptedProposals.length, suppliers: suppliers.filter((row) => row.active !== false).length },
    conversion: { leadToCall: percentage(bookedLeadIds.size, leads.length), leadToCase: percentage(caseLeadIds.size, leads.length), caseToAccepted: percentage(acceptedCases.length, cases.length), proposalToAccepted: percentage(acceptedProposals.length, proposals.length) },
    timing: { leadToCaseHours: average(leadToCaseTimes), caseToProposalHours: average(caseToProposalTimes), proposalToAcceptanceHours: average(proposalAcceptanceTimes), caseToCloseDays: average(caseCloseTimes) },
    taskHealth: { open: openTasks.length, overdue: overdueTasks.length, blocked: blockedTasks.length, done: doneTasks.length, completionRate: percentage(doneTasks.length, doneTasks.length + openTasks.length) },
    caseHealth: { critical: caseHealth.stats.critical, attention: caseHealth.stats.attention, blocked: caseHealth.stats.blocked, upcoming30: caseHealth.stats.upcoming30 },
    financials: [...financialMap.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    sources: sourceRows,
    destinations: destinationRows,
    suppliers: supplierRows,
    monthly: [...monthMap.values()],
  };
}
