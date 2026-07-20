import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { PROPOSAL_WITH_VERSIONS_SELECT, PURCHASE_WITH_RELATIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import type { GlobalSearchResult as BaseGlobalSearchResult, RepositoryResult } from "@/lib/server-repositories";

type GlobalSearchResult = Omit<BaseGlobalSearchResult, "type"> & {
  type: BaseGlobalSearchResult["type"] | "proveedor";
};

function unavailable<T>(): RepositoryResult<T> { return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" }; }
function oneRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

const CLIENT_SELECT = "id,client_type,display_name,email,email_normalized,phone,phone_normalized,tax_id,billing_address,country,language,source,holded_contact_id,notes,created_at,updated_at";
const CLIENT_PAGE_SIZES = new Set([50, 100, 150, 200]);
const SUPPLIER_SELECT = "id,name,category,email,phone,tax_id,country,billing_address,notes,active,holded_contact_id,created_at,updated_at";
const SUPPLIER_PAGE_SIZES = new Set([50, 100, 150, 200]);

export type OrganizationClientStats = {
  total: number;
  withEmail: number;
  withPhone: number;
  fiscalComplete: number;
};

export type OrganizationClientPage = {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  stats: OrganizationClientStats;
};

export type OrganizationSupplierStats = {
  total: number;
  active: number;
  linkedToHolded: number;
  fiscalComplete: number;
  pendingPurchases: number;
  expectedTotal: number;
  approvedTotal: number;
  invoicedTotal: number;
};

export type OrganizationSupplierPage = {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  status: "all" | "active" | "inactive";
  stats: OrganizationSupplierStats;
};

function normalizeClientPageSize(value?: number) {
  const candidate = Number(value || 50);
  return CLIENT_PAGE_SIZES.has(candidate) ? candidate : 50;
}

function normalizeClientPage(value?: number) {
  const candidate = Math.floor(Number(value || 1));
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 1;
}

function cleanClientQuery(value?: string) {
  return String(value || "").trim().slice(0, 100).replace(/[,%()\\]/g, " ").replace(/\s+/g, " ");
}

function normalizeSupplierPageSize(value?: number) {
  const candidate = Number(value || 50);
  return SUPPLIER_PAGE_SIZES.has(candidate) ? candidate : 50;
}

function normalizeSupplierPage(value?: number) {
  const candidate = Math.floor(Number(value || 1));
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 1;
}

function cleanSupplierQuery(value?: string) {
  return String(value || "").trim().slice(0, 100).replace(/[,%()\\]/g, " ").replace(/\s+/g, " ");
}

function normalizeSupplierStatus(value?: string): "all" | "active" | "inactive" {
  return value === "inactive" ? "inactive" : value === "all" ? "all" : "active";
}

export async function listOrganizationClientsPage(
  organizationId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<RepositoryResult<OrganizationClientPage>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const db = getSupabaseAdminClient();
  const requestedPage = normalizeClientPage(options.page);
  const pageSize = normalizeClientPageSize(options.pageSize);
  const query = cleanClientQuery(options.query);

  let rowsQuery = db
    .from("clients")
    .select(CLIENT_SELECT, { count: "exact" })
    .eq("organization_id", organizationId);
  if (query) {
    const like = `%${query}%`;
    rowsQuery = rowsQuery.or(`display_name.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like},country.ilike.${like}`);
  }

  const requestedFrom = (requestedPage - 1) * pageSize;
  const requestedTo = requestedFrom + pageSize - 1;
  const [rowsResult, totalResult, emailResult, phoneResult, fiscalResult] = await Promise.all([
    rowsQuery.order("created_at", { ascending: false }).range(requestedFrom, requestedTo),
    db.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    db.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("email", "is", null).neq("email", ""),
    db.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("phone", "is", null).neq("phone", ""),
    db.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("tax_id", "is", null).neq("tax_id", "").not("billing_address->>address", "is", null).neq("billing_address->>address", ""),
  ]);

  const firstError = [rowsResult.error, totalResult.error, emailResult.error, phoneResult.error, fiscalResult.error].find(Boolean);
  if (firstError) return { ok: false, mode: "supabase", error: firstError.message };

  const filteredTotal = rowsResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const page = Math.min(requestedPage, totalPages);
  let items = rowsResult.data || [];

  if (page !== requestedPage && filteredTotal > 0) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let correctedQuery = db.from("clients").select(CLIENT_SELECT).eq("organization_id", organizationId);
    if (query) {
      const like = `%${query}%`;
      correctedQuery = correctedQuery.or(`display_name.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like},country.ilike.${like}`);
    }
    const corrected = await correctedQuery.order("created_at", { ascending: false }).range(from, to);
    if (corrected.error) return { ok: false, mode: "supabase", error: corrected.error.message };
    items = corrected.data || [];
  }

  return {
    ok: true,
    mode: "supabase",
    data: {
      items,
      total: filteredTotal,
      page,
      pageSize,
      totalPages,
      query,
      stats: {
        total: totalResult.count || 0,
        withEmail: emailResult.count || 0,
        withPhone: phoneResult.count || 0,
        fiscalComplete: fiscalResult.count || 0,
      },
    },
  };
}

export async function listOrganizationSuppliersPage(
  organizationId: string,
  options: { page?: number; pageSize?: number; query?: string; status?: string } = {},
): Promise<RepositoryResult<OrganizationSupplierPage>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const db = getSupabaseAdminClient();
  const requestedPage = normalizeSupplierPage(options.page);
  const pageSize = normalizeSupplierPageSize(options.pageSize);
  const query = cleanSupplierQuery(options.query);
  const status = normalizeSupplierStatus(options.status);

  let rowsQuery = db.from("suppliers").select(SUPPLIER_SELECT, { count: "exact" }).eq("organization_id", organizationId);
  if (status === "active") rowsQuery = rowsQuery.eq("active", true);
  if (status === "inactive") rowsQuery = rowsQuery.eq("active", false);
  if (query) {
    const like = `%${query}%`;
    rowsQuery = rowsQuery.or(`name.ilike.${like},category.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like},country.ilike.${like}`);
  }

  const requestedFrom = (requestedPage - 1) * pageSize;
  const requestedTo = requestedFrom + pageSize - 1;
  const [rowsResult, totalResult, activeResult, holdedResult, fiscalResult, purchaseStatsResult, invoiceStatsResult] = await Promise.all([
    rowsQuery.order("active", { ascending: false }).order("name", { ascending: true }).range(requestedFrom, requestedTo),
    db.from("suppliers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    db.from("suppliers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("active", true),
    db.from("suppliers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("holded_contact_id", "is", null).neq("holded_contact_id", ""),
    db.from("suppliers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("tax_id", "is", null).neq("tax_id", "").not("billing_address->>address", "is", null).neq("billing_address->>address", ""),
    db.from("expected_purchases").select("supplier_id,status,expected_amount,approved_cost").eq("organization_id", organizationId).not("supplier_id", "is", null).limit(5000),
    db.from("supplier_invoices").select("supplier_id,total_amount,status").eq("organization_id", organizationId).not("supplier_id", "is", null).limit(5000),
  ]);

  const firstError = [rowsResult.error, totalResult.error, activeResult.error, holdedResult.error, fiscalResult.error, purchaseStatsResult.error, invoiceStatsResult.error].find(Boolean);
  if (firstError) return { ok: false, mode: "supabase", error: firstError.message };

  const filteredTotal = rowsResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const page = Math.min(requestedPage, totalPages);
  let suppliers = rowsResult.data || [];

  if (page !== requestedPage && filteredTotal > 0) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let correctedQuery = db.from("suppliers").select(SUPPLIER_SELECT).eq("organization_id", organizationId);
    if (status === "active") correctedQuery = correctedQuery.eq("active", true);
    if (status === "inactive") correctedQuery = correctedQuery.eq("active", false);
    if (query) {
      const like = `%${query}%`;
      correctedQuery = correctedQuery.or(`name.ilike.${like},category.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like},country.ilike.${like}`);
    }
    const corrected = await correctedQuery.order("active", { ascending: false }).order("name", { ascending: true }).range(from, to);
    if (corrected.error) return { ok: false, mode: "supabase", error: corrected.error.message };
    suppliers = corrected.data || [];
  }

  const purchases = purchaseStatsResult.data || [];
  const invoices = invoiceStatsResult.data || [];
  const bySupplierPurchases = new Map<string, typeof purchases>();
  const bySupplierInvoices = new Map<string, typeof invoices>();
  for (const purchase of purchases) {
    const supplierId = String(purchase.supplier_id || "");
    if (!supplierId) continue;
    bySupplierPurchases.set(supplierId, [...(bySupplierPurchases.get(supplierId) || []), purchase]);
  }
  for (const invoice of invoices) {
    const supplierId = String(invoice.supplier_id || "");
    if (!supplierId) continue;
    bySupplierInvoices.set(supplierId, [...(bySupplierInvoices.get(supplierId) || []), invoice]);
  }

  const items = suppliers.map((supplier) => {
    const supplierId = String(supplier.id || "");
    const relatedPurchases = bySupplierPurchases.get(supplierId) || [];
    const relatedInvoices = bySupplierInvoices.get(supplierId) || [];
    return {
      ...supplier,
      purchase_count: relatedPurchases.length,
      pending_count: relatedPurchases.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status))).length,
      expected_total: relatedPurchases.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0),
      approved_total: relatedPurchases.reduce((sum, item) => sum + Number(item.approved_cost || 0), 0),
      invoiced_total: relatedInvoices.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    };
  });

  return {
    ok: true,
    mode: "supabase",
    data: {
      items,
      total: filteredTotal,
      page,
      pageSize,
      totalPages,
      query,
      status,
      stats: {
        total: totalResult.count || 0,
        active: activeResult.count || 0,
        linkedToHolded: holdedResult.count || 0,
        fiscalComplete: fiscalResult.count || 0,
        pendingPurchases: purchases.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status))).length,
        expectedTotal: purchases.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0),
        approvedTotal: purchases.reduce((sum, item) => sum + Number(item.approved_cost || 0), 0),
        invoicedTotal: invoices.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
      },
    },
  };
}

export async function listOrganizationClients(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  const result = await listOrganizationClientsPage(organizationId, { page: 1, pageSize: 200 });
  return result.ok
    ? { ok: true, mode: "supabase", data: result.data.items }
    : result;
}

export async function listOrganizationClientActivity(organizationId: string): Promise<RepositoryResult<{ leads: unknown[]; bookings: unknown[]; tasks: unknown[]; cases: unknown[]; filloutUrl: string }>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const db = getSupabaseAdminClient();
  const [leadsResult, bookingsResult, tasksResult, casesResult, settings] = await Promise.all([
    db.from("leads").select("id,client_id,source,status,destination,travel_start,travel_end,travelers,budget_hint,created_at,updated_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
    db.from("bookings").select("id,client_id,lead_id,external_booking_id,event_type,starts_at,ends_at,status,source,created_at,updated_at").eq("organization_id", organizationId).order("event_timestamp", { ascending: false }).limit(200),
    db.from("tasks").select("id,client_id,case_id,title,status,priority,due_at,payload,created_at,updated_at").eq("organization_id", organizationId).in("status", ["pending", "in_progress"]).order("created_at", { ascending: false }).limit(200),
    db.from("cases").select("id,client_id,case_code,title,status,destination,trip_start,trip_end,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
    loadEffectiveSettings(organizationId),
  ]);
  const firstError = [leadsResult.error, bookingsResult.error, tasksResult.error, casesResult.error].find(Boolean);
  if (firstError) return { ok: false, mode: "supabase", error: firstError.message };
  const filloutUrl = settings.string("integrations.fillout.public_url", "");
  return { ok: true, mode: "supabase", data: { leads: leadsResult.data || [], bookings: bookingsResult.data || [], tasks: tasksResult.data || [], cases: casesResult.data || [], filloutUrl } };
}

export async function listOrganizationCases(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient().from("cases").select("*, clients(display_name,email,phone,holded_contact_id)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function listOrganizationProposals(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient().from("proposals").select(PROPOSAL_WITH_VERSIONS_SELECT).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function listOrganizationPurchases(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").select(PURCHASE_WITH_RELATIONS_SELECT).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function listOrganizationSuppliers(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient().from("suppliers")
    .select(SUPPLIER_SELECT)
    .eq("organization_id", organizationId)
    .order("active", { ascending: false })
    .order("name", { ascending: true })
    .limit(500);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function searchOrganization(organizationId: string, query: string): Promise<RepositoryResult<GlobalSearchResult[]>> {
  const cleaned = query.trim().slice(0, 80).replaceAll("%", "").replaceAll(",", " ");
  if (!cleaned) return { ok: true, mode: "supabase", data: [] };
  if (!hasSupabaseAdminEnv()) return unavailable();
  const supabase = getSupabaseAdminClient();
  const like = `%${cleaned}%`;
  const results: GlobalSearchResult[] = [];
  const [{ data: clients }, { data: cases }, { data: proposals }, { data: purchases }, { data: suppliers }] = await Promise.all([
    supabase.from("clients").select("id,display_name,email,phone").eq("organization_id", organizationId).or(`display_name.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like}`).limit(8),
    supabase.from("cases").select("id,case_code,title,destination,status").eq("organization_id", organizationId).or(`case_code.ilike.${like},title.ilike.${like},destination.ilike.${like}`).limit(8),
    supabase.from("proposals").select("id,status,cases(id,case_code,title,clients(display_name))").eq("organization_id", organizationId).limit(50),
    supabase.from("expected_purchases").select("id,supplier_name,service,status,cases(case_code)").eq("organization_id", organizationId).or(`supplier_name.ilike.${like},service.ilike.${like}`).limit(8),
    supabase.from("suppliers").select("id,name,category,email,phone,country").eq("organization_id", organizationId).or(`name.ilike.${like},category.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like},country.ilike.${like}`).limit(8),
  ]);
  for (const client of clients || []) results.push({ type: "cliente", title: String(client.display_name || "Cliente"), subtitle: String(client.email || client.phone || "Cliente"), href: `/clientes/${client.id}` });
  for (const item of cases || []) results.push({ type: "expediente", title: String(item.case_code || "Expediente"), subtitle: String(item.title || item.destination || "Expediente"), href: `/expedientes?caseId=${item.id}` });
  for (const rawProposal of proposals || []) {
    const proposal = rawProposal as Record<string, unknown>; const caseRow = oneRecord(proposal.cases); const clientRow = oneRecord(caseRow?.clients);
    if ([caseRow?.case_code, caseRow?.title, clientRow?.display_name, proposal.status].filter(Boolean).join(" ").toLowerCase().includes(cleaned.toLowerCase())) results.push({ type: "presupuesto", title: String(caseRow?.case_code || "Presupuesto"), subtitle: `${String(clientRow?.display_name || caseRow?.title || "Expediente")} · ${String(proposal.status || "draft")}`, href: caseRow?.id ? `/propuestas?caseId=${caseRow.id}` : "/propuestas" });
  }
  for (const rawPurchase of purchases || []) { const purchase = rawPurchase as Record<string, unknown>; const caseRow = oneRecord(purchase.cases); results.push({ type: "compra", title: String(purchase.supplier_name || "Compra"), subtitle: `${String(caseRow?.case_code || "Sin expediente")} · ${String(purchase.service || purchase.status || "Compra")}`, href: "/compras" }); }
  for (const supplier of suppliers || []) results.push({ type: "proveedor", title: String(supplier.name || "Proveedor"), subtitle: [supplier.category, supplier.country, supplier.email || supplier.phone].filter(Boolean).join(" · ") || "Proveedor", href: `/proveedores?supplierId=${supplier.id}` });
  return { ok: true, mode: "supabase", data: results.slice(0, 40) };
}
