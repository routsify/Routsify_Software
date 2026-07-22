import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isCaseStatus, type CaseStatus } from "@/lib/case-status";

export type CaseHealthLevel = "good" | "attention" | "critical";
export type CaseDirectoryStatus = "active" | "all" | CaseStatus;

export type CaseDirectoryRow = {
  id: string;
  case_code: string;
  title: string | null;
  status: CaseStatus;
  destination: string | null;
  trip_start: string | null;
  trip_end: string | null;
  next_action: string | null;
  next_action_at: string | null;
  blocker: string | null;
  accepted_value: number;
  currency: string;
  priority: string | null;
  updated_at: string | null;
  client_id: string | null;
  clients: { display_name?: string | null; email?: string | null; phone?: string | null } | null;
  open_tasks: number;
  overdue_tasks: number;
  pending_purchases: number;
  traveler_count: number;
  travelers_pending: number;
  documents_pending: number;
  contract_status: string;
  paid_total: number;
  payment_pending: number;
  budgeted_cost: number;
  real_cost: number;
  budgeted_profit: number;
  real_profit: number;
  margin_pct: number;
  days_to_trip: number | null;
  health_score: number;
  health_level: CaseHealthLevel;
  health_issues: string[];
};

export type CaseDirectoryStats = {
  total: number;
  active: number;
  blocked: number;
  critical: number;
  attention: number;
  upcoming30: number;
  acceptedValue: number;
  paidTotal: number;
  realCost: number;
  realProfit: number;
};

export type CaseDirectoryPage = {
  items: CaseDirectoryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  status: CaseDirectoryStatus;
  health: "all" | CaseHealthLevel;
  stats: CaseDirectoryStats;
};

type Row = Record<string, unknown>;
const PAGE_SIZES = new Set([25, 50, 100, 150, 200]);
const CLOSED_STATUSES = new Set(["closed"]);
const APPROVED_PURCHASE_STATUSES = new Set(["approved", "not_required", "cancelled"]);
const PAID_STATUSES = new Set(["confirmed", "paid", "received"]);
const VALID_DOCUMENT_STATUSES = new Set(["uploaded", "verified", "approved", "valid"]);
const VALID_TRAVELER_STATUSES = new Set(["approved", "verified"]);

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function cleanQuery(value?: string) { return String(value || "").trim().slice(0, 100).replace(/[,%()\\]/g, " ").replace(/\s+/g, " "); }
function normalizePage(value?: number) { const parsed = Math.floor(Number(value || 1)); return Number.isFinite(parsed) && parsed > 0 ? parsed : 1; }
function normalizePageSize(value?: number) { const parsed = Number(value || 50); return PAGE_SIZES.has(parsed) ? parsed : 50; }
function normalizeHealth(value?: string): "all" | CaseHealthLevel { return value === "critical" || value === "attention" || value === "good" ? value : "all"; }
function normalizeCaseStatus(value?: string): CaseDirectoryStatus {
  if (value === "all" || value === "active" || isCaseStatus(value)) return value;
  return "active";
}
function one(value: unknown): Row | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as Row : null;
  return value && typeof value === "object" ? value as Row : null;
}
function groupByCase(rows: Row[]) {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const caseId = text(row.case_id);
    if (!caseId) continue;
    map.set(caseId, [...(map.get(caseId) || []), row]);
  }
  return map;
}
function dateMs(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value).length === 10 ? `${String(value)}T12:00:00Z` : String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
function daysTo(value: unknown, now = Date.now()) {
  const target = dateMs(value);
  return target === null ? null : Math.ceil((target - now) / 86_400_000);
}

function healthFor(input: {
  caseRow: Row;
  openTasks: Row[];
  pendingPurchases: Row[];
  travelers: Row[];
  documents: Row[];
  contracts: Row[];
  paidTotal: number;
  acceptedValue: number;
  marginPct: number;
  minimumMargin: number;
  daysToTrip: number | null;
}) {
  const issues: string[] = [];
  let score = 100;
  const status = text(input.caseRow.status);
  const active = !CLOSED_STATUSES.has(status);
  const overdueTasks = input.openTasks.filter((task) => {
    const due = dateMs(task.due_at);
    return Boolean(due && due < Date.now());
  });
  const travelersPending = input.travelers.filter((traveler) => !VALID_TRAVELER_STATUSES.has(text(traveler.review_status)) || !text(traveler.document_number) || !text(traveler.document_expires_at));
  const documentsPending = input.documents.filter((document) => document.required !== false && !VALID_DOCUMENT_STATUSES.has(text(document.status)));
  const signedContract = input.contracts.some((contract) => text(contract.status) === "signed");

  if (text(input.caseRow.blocker)) { score -= 35; issues.push(`Bloqueado: ${text(input.caseRow.blocker)}`); }
  if (overdueTasks.length) { score -= Math.min(25, 8 + overdueTasks.length * 4); issues.push(`${overdueTasks.length} tarea${overdueTasks.length === 1 ? "" : "s"} vencida${overdueTasks.length === 1 ? "" : "s"}`); }
  if (active && !text(input.caseRow.next_action)) { score -= 10; issues.push("Sin siguiente acción definida"); }
  if (active && input.daysToTrip === null) { score -= 5; issues.push("Fechas de viaje pendientes"); }
  if (active && input.daysToTrip !== null && input.daysToTrip < 0 && status !== "ready_to_close") { score -= 20; issues.push("El viaje ya ha comenzado o terminado y el estado no está actualizado"); }
  if (active && input.daysToTrip !== null && input.daysToTrip <= 30 && input.acceptedValue > 0 && !signedContract) { score -= 20; issues.push("Contrato sin firmar a menos de 30 días"); }
  if (active && input.daysToTrip !== null && input.daysToTrip <= 30 && input.acceptedValue > input.paidTotal + 0.01) { score -= 20; issues.push(`Cobro pendiente: ${(input.acceptedValue - input.paidTotal).toFixed(2)} €`); }
  if (active && input.daysToTrip !== null && input.daysToTrip <= 21 && input.pendingPurchases.length) { score -= Math.min(25, 10 + input.pendingPurchases.length * 4); issues.push(`${input.pendingPurchases.length} compra${input.pendingPurchases.length === 1 ? "" : "s"} pendiente${input.pendingPurchases.length === 1 ? "" : "s"}`); }
  if (active && input.daysToTrip !== null && input.daysToTrip <= 14 && travelersPending.length) { score -= Math.min(20, 8 + travelersPending.length * 3); issues.push(`${travelersPending.length} viajero${travelersPending.length === 1 ? "" : "s"} con documentación pendiente`); }
  if (active && input.daysToTrip !== null && input.daysToTrip <= 14 && documentsPending.length) { score -= Math.min(15, 5 + documentsPending.length * 3); issues.push(`${documentsPending.length} documento${documentsPending.length === 1 ? "" : "s"} requerido${documentsPending.length === 1 ? "" : "s"} pendiente${documentsPending.length === 1 ? "" : "s"}`); }
  if (input.acceptedValue > 0 && input.marginPct < input.minimumMargin) { score -= 15; issues.push(`Margen ${input.marginPct.toFixed(1)} %, inferior al mínimo ${input.minimumMargin.toFixed(1)} %`); }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const level: CaseHealthLevel = normalizedScore < 55 ? "critical" : normalizedScore < 80 ? "attention" : "good";
  return { score: normalizedScore, level, issues, overdueTasks: overdueTasks.length, travelersPending: travelersPending.length, documentsPending: documentsPending.length, signedContract };
}

export async function listCaseDirectoryPage(
  organizationId: string,
  options: { page?: number; pageSize?: number; query?: string; status?: string; health?: string } = {},
): Promise<CaseDirectoryPage> {
  const db = getSupabaseAdminClient();
  const settings = await loadEffectiveSettings(organizationId);
  const minimumMargin = settings.number("margins.minimum", 12);
  const requestedPage = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);
  const query = cleanQuery(options.query);
  const status = normalizeCaseStatus(options.status);
  const health = normalizeHealth(options.health);

  let baseQuery = db.from("cases").select("id,client_id,case_code,title,status,destination,trip_start,trip_end,next_action,next_action_at,blocker,accepted_value,currency,priority,updated_at,clients(display_name,email,phone)").eq("organization_id", organizationId);
  if (status === "active") baseQuery = baseQuery.neq("status", "closed");
  else if (status === "closed") baseQuery = baseQuery.eq("status", "closed");
  else if (status !== "all") baseQuery = baseQuery.eq("status", status);
  if (query) {
    const like = `%${query}%`;
    baseQuery = baseQuery.or(`case_code.ilike.${like},title.ilike.${like},destination.ilike.${like},next_action.ilike.${like},blocker.ilike.${like}`);
  }

  const { data: allCasesData, error: casesError } = await baseQuery.order("updated_at", { ascending: false }).limit(5000);
  if (casesError) throw new Error(casesError.message);
  const allCases = (allCasesData || []) as Row[];
  const ids = allCases.map((row) => text(row.id)).filter(Boolean);
  if (!ids.length) {
    return { items: [], total: 0, page: 1, pageSize, totalPages: 1, query, status, health, stats: { total: 0, active: 0, blocked: 0, critical: 0, attention: 0, upcoming30: 0, acceptedValue: 0, paidTotal: 0, realCost: 0, realProfit: 0 } };
  }

  const [tasksResult, purchasesResult, travelersResult, documentsResult, contractsResult, paymentsResult, proposalsResult] = await Promise.all([
    db.from("tasks").select("id,case_id,status,priority,due_at,blocker").eq("organization_id", organizationId).in("case_id", ids).in("status", ["pending", "in_progress"]).limit(10_000),
    db.from("expected_purchases").select("id,case_id,status,required,active,expected_amount,approved_cost,invoice_total").eq("organization_id", organizationId).in("case_id", ids).limit(10_000),
    db.from("travelers").select("id,case_id,review_status,document_number,document_expires_at").eq("organization_id", organizationId).in("case_id", ids).limit(10_000),
    db.from("documents").select("id,case_id,status,required,purged_at").eq("organization_id", organizationId).in("case_id", ids).is("purged_at", null).limit(10_000),
    db.from("contracts").select("id,case_id,status,signed_at").eq("organization_id", organizationId).in("case_id", ids).limit(10_000),
    db.from("payments").select("id,case_id,status,amount").eq("organization_id", organizationId).in("case_id", ids).limit(10_000),
    db.from("proposals").select("id,case_id,status,current_version_id,proposal_versions!proposal_versions_proposal_id_fkey(id,total_cost_budget,total_cost_real,budgeted_profit,real_profit,real_margin_pct,version_number,status)").eq("organization_id", organizationId).in("case_id", ids).limit(5000),
  ]);
  const firstError = [tasksResult.error, purchasesResult.error, travelersResult.error, documentsResult.error, contractsResult.error, paymentsResult.error, proposalsResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const tasksByCase = groupByCase((tasksResult.data || []) as Row[]);
  const purchasesByCase = groupByCase((purchasesResult.data || []) as Row[]);
  const travelersByCase = groupByCase((travelersResult.data || []) as Row[]);
  const documentsByCase = groupByCase((documentsResult.data || []) as Row[]);
  const contractsByCase = groupByCase((contractsResult.data || []) as Row[]);
  const paymentsByCase = groupByCase((paymentsResult.data || []) as Row[]);
  const proposalsByCase = groupByCase((proposalsResult.data || []) as Row[]);

  const enriched = allCases.map((caseRow): CaseDirectoryRow => {
    const caseId = text(caseRow.id);
    const openTasks = tasksByCase.get(caseId) || [];
    const purchases = purchasesByCase.get(caseId) || [];
    const pendingPurchases = purchases.filter((purchase) => purchase.required !== false && purchase.active !== false && !APPROVED_PURCHASE_STATUSES.has(text(purchase.status)));
    const travelers = travelersByCase.get(caseId) || [];
    const documents = documentsByCase.get(caseId) || [];
    const contracts = contractsByCase.get(caseId) || [];
    const payments = paymentsByCase.get(caseId) || [];
    const proposals = proposalsByCase.get(caseId) || [];
    const acceptedProposal = proposals.find((proposal) => text(proposal.status) === "accepted") || proposals[0];
    const versionsValue = acceptedProposal?.proposal_versions;
    const versions = Array.isArray(versionsValue) ? versionsValue.filter((value): value is Row => Boolean(value && typeof value === "object")) : one(versionsValue) ? [one(versionsValue) as Row] : [];
    const currentVersionId = text(acceptedProposal?.current_version_id);
    const version = versions.find((item) => text(item.id) === currentVersionId) || versions.sort((left, right) => numberValue(right.version_number) - numberValue(left.version_number))[0] || null;
    const acceptedValue = numberValue(caseRow.accepted_value);
    const paidTotal = payments.filter((payment) => PAID_STATUSES.has(text(payment.status))).reduce((sum, payment) => sum + numberValue(payment.amount), 0);
    const budgetedCost = numberValue(version?.total_cost_budget);
    const realCostFromVersion = numberValue(version?.total_cost_real);
    const realCost = realCostFromVersion || purchases.filter((purchase) => text(purchase.status) === "approved").reduce((sum, purchase) => sum + numberValue(purchase.approved_cost || purchase.invoice_total), 0);
    const budgetedProfit = numberValue(version?.budgeted_profit) || Math.max(0, acceptedValue - budgetedCost);
    const realProfit = numberValue(version?.real_profit) || (acceptedValue ? acceptedValue - realCost : 0);
    const storedMargin = numberValue(version?.real_margin_pct);
    const marginPct = storedMargin
      ? (Math.abs(storedMargin) <= 1 ? storedMargin * 100 : storedMargin)
      : (acceptedValue > 0 ? realProfit / acceptedValue * 100 : 0);
    const days = daysTo(caseRow.trip_start);
    const healthResult = healthFor({ caseRow, openTasks, pendingPurchases, travelers, documents, contracts, paidTotal, acceptedValue, marginPct, minimumMargin, daysToTrip: days });
    const client = one(caseRow.clients);

    return {
      id: caseId,
      case_code: text(caseRow.case_code) || "EXP-SIN-CÓDIGO",
      title: text(caseRow.title) || null,
      status: isCaseStatus(caseRow.status) ? caseRow.status : "new_lead",
      destination: text(caseRow.destination) || null,
      trip_start: text(caseRow.trip_start) || null,
      trip_end: text(caseRow.trip_end) || null,
      next_action: text(caseRow.next_action) || null,
      next_action_at: text(caseRow.next_action_at) || null,
      blocker: text(caseRow.blocker) || null,
      accepted_value: acceptedValue,
      currency: text(caseRow.currency) || "EUR",
      priority: text(caseRow.priority) || null,
      updated_at: text(caseRow.updated_at) || null,
      client_id: text(caseRow.client_id) || null,
      clients: client ? { display_name: text(client.display_name) || null, email: text(client.email) || null, phone: text(client.phone) || null } : null,
      open_tasks: openTasks.length,
      overdue_tasks: healthResult.overdueTasks,
      pending_purchases: pendingPurchases.length,
      traveler_count: travelers.length,
      travelers_pending: healthResult.travelersPending,
      documents_pending: healthResult.documentsPending,
      contract_status: healthResult.signedContract ? "signed" : contracts.length ? text(contracts[0].status) || "draft" : "missing",
      paid_total: paidTotal,
      payment_pending: Math.max(0, acceptedValue - paidTotal),
      budgeted_cost: budgetedCost,
      real_cost: realCost,
      budgeted_profit: budgetedProfit,
      real_profit: realProfit,
      margin_pct: marginPct,
      days_to_trip: days,
      health_score: healthResult.score,
      health_level: healthResult.level,
      health_issues: healthResult.issues,
    };
  });

  const healthFiltered = health === "all" ? enriched : enriched.filter((item) => item.health_level === health);
  healthFiltered.sort((left, right) => {
    const healthOrder = { critical: 0, attention: 1, good: 2 } as const;
    return healthOrder[left.health_level] - healthOrder[right.health_level] || left.health_score - right.health_score || String(right.updated_at || "").localeCompare(String(left.updated_at || ""));
  });
  const total = healthFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * pageSize;
  const items = healthFiltered.slice(from, from + pageSize);
  const allActive = enriched.filter((item) => !CLOSED_STATUSES.has(item.status));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    query,
    status,
    health,
    stats: {
      total: enriched.length,
      active: allActive.length,
      blocked: enriched.filter((item) => Boolean(item.blocker)).length,
      critical: enriched.filter((item) => item.health_level === "critical").length,
      attention: enriched.filter((item) => item.health_level === "attention").length,
      upcoming30: allActive.filter((item) => item.days_to_trip !== null && item.days_to_trip >= 0 && item.days_to_trip <= 30).length,
      acceptedValue: enriched.reduce((sum, item) => sum + item.accepted_value, 0),
      paidTotal: enriched.reduce((sum, item) => sum + item.paid_total, 0),
      realCost: enriched.reduce((sum, item) => sum + item.real_cost, 0),
      realProfit: enriched.reduce((sum, item) => sum + item.real_profit, 0),
    },
  };
}
