import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import type { AppSetting } from "@/lib/settings-master";

export type RepositoryMode = "supabase";
export type RepositoryResult<T> = { ok: true; mode: RepositoryMode; data: T } | { ok: false; mode: RepositoryMode; error: string };

export type GlobalSearchResult = {
  type: "cliente" | "expediente" | "presupuesto" | "compra";
  title: string;
  subtitle: string;
  href: string;
};

type ClientRepositoryInput = {
  organization_id?: string;
  name?: string;
  display_name?: string;
  client_type?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  billing_address?: string | Record<string, unknown>;
  country?: string;
  language?: string;
  source?: string;
  origin?: string;
  notes?: string;
};

type CaseRepositoryInput = { organization_id?: string; client_id?: string | null; client_name?: string | null; title?: string | null; destination?: string | null; trip_start?: string | null; trip_end?: string | null; status?: string | null; next_action?: string | null; blocker?: string | null; final_notes?: string | null };
type ProposalRepositoryInput = { organization_id?: string; case_id?: string; status?: string | null };
type BudgetLineInput = { organization_id?: string; proposal_id?: string; proposal_version_id?: string; service_type_code?: string; description_public?: string; supplier_name?: string | null; cost_budget?: number; margin_applied?: number; sale_price?: number };

function canUseSupabase() {
  return hasSupabaseAdminEnv();
}

function emptyProductionResult<T>(data: T): RepositoryResult<T> {
  return { ok: true, mode: "supabase", data };
}

function randomCaseCode() {
  return `EXP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

function normalizeMoney(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function repositoryMode(): RepositoryMode {
  return "supabase";
}

export async function listClientsRepository(): Promise<RepositoryResult<unknown[]>> {
  if (!canUseSupabase()) return emptyProductionResult([]);
  const { data, error } = await getSupabaseAdminClient().from("clients").select("*").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function createClientRepository(input: ClientRepositoryInput): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").replace(/\D/g, "");
  const payload = {
    organization_id: input.organization_id,
    display_name: input.display_name || input.name || "Cliente sin nombre",
    client_type: input.client_type || "person",
    email: email || null,
    email_normalized: email || null,
    phone: input.phone || null,
    phone_normalized: phone || null,
    tax_id: input.tax_id || null,
    billing_address: typeof input.billing_address === "string" ? { address: input.billing_address } : input.billing_address || {},
    country: input.country || "ES",
    language: input.language || "es",
    source: input.origin || input.source || "manual",
    notes: input.notes || null,
  };
  const { data, error } = await getSupabaseAdminClient().from("clients").upsert(payload, { onConflict: "organization_id,email_normalized" }).select("*").single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function listCasesRepository(): Promise<RepositoryResult<unknown[]>> {
  if (!canUseSupabase()) return emptyProductionResult([]);
  const { data, error } = await getSupabaseAdminClient().from("cases").select("*, clients(display_name,email,phone,holded_contact_id)").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function createCaseRepository(input: CaseRepositoryInput): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  if (!input.organization_id) return { ok: false, mode: "supabase", error: "organization_required" };

  const supabase = getSupabaseAdminClient();
  let clientId = input.client_id || null;
  const clientName = String(input.client_name || "").trim();

  if (!clientId && clientName) {
    const { data: client, error: clientError } = await supabase.from("clients").insert({ organization_id: input.organization_id, display_name: clientName, client_type: "person", source: "manual" }).select("id").single();
    if (clientError) return { ok: false, mode: "supabase", error: clientError.message };
    clientId = client.id;
  }

  const destination = String(input.destination || "").trim();
  const title = String(input.title || destination || clientName || "Nuevo expediente").trim();
  const payload = {
    organization_id: input.organization_id,
    case_code: randomCaseCode(),
    client_id: clientId,
    title,
    destination: destination || null,
    trip_start: input.trip_start || null,
    trip_end: input.trip_end || null,
    status: input.status || "new_lead",
    next_action: input.next_action || "Revisar expediente",
    blocker: input.blocker || null,
    final_notes: input.final_notes || null,
  };

  const { data, error } = await supabase.from("cases").insert(payload).select("*, clients(display_name,email,phone,holded_contact_id)").single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function updateCaseRepository(caseId: string, input: Partial<CaseRepositoryInput>): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["title", "destination", "trip_start", "trip_end", "status", "next_action", "blocker", "final_notes"] as const) {
    if (key in input) payload[key] = input[key] || null;
  }
  const { data, error } = await getSupabaseAdminClient().from("cases").update(payload).eq("id", caseId).select("*, clients(display_name,email,phone,holded_contact_id)").single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function createTimelineEventRepository(input: { organizationId: string; caseId?: string | null; clientId?: string | null; eventType: string; title: string; payload?: Record<string, unknown>; createdBy?: string | null }): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const { data, error } = await getSupabaseAdminClient().from("timeline_events").insert({ organization_id: input.organizationId, case_id: input.caseId || null, client_id: input.clientId || null, event_type: input.eventType, title: input.title, payload: input.payload || {}, created_by: input.createdBy || null }).select("*").single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function listProposalsRepository(): Promise<RepositoryResult<unknown[]>> {
  if (!canUseSupabase()) return emptyProductionResult([]);
  const { data, error } = await getSupabaseAdminClient().from("proposals").select("*, cases(case_code,title,destination,trip_start,trip_end,clients(display_name,email)), proposal_versions(*, budget_lines(*))").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function createProposalRepository(input: ProposalRepositoryInput): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  if (!input.organization_id || !input.case_id) return { ok: false, mode: "supabase", error: "case_required" };
  const supabase = getSupabaseAdminClient();
  const { data: proposal, error: proposalError } = await supabase.from("proposals").insert({ organization_id: input.organization_id, case_id: input.case_id, status: input.status || "draft" }).select("*").single();
  if (proposalError) return { ok: false, mode: "supabase", error: proposalError.message };
  const { error: versionError } = await supabase.from("proposal_versions").insert({ organization_id: input.organization_id, proposal_id: proposal.id, version_number: 1, status: "draft", total_sale: 0, total_cost: 0 });
  if (versionError) return { ok: false, mode: "supabase", error: versionError.message };
  const { data, error } = await supabase.from("proposals").select("*, cases(case_code,title,destination,trip_start,trip_end,clients(display_name,email)), proposal_versions(*, budget_lines(*))").eq("id", proposal.id).single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function updateProposalStatusRepository(proposalId: string, status: string): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const supabase = getSupabaseAdminClient();
  const { error: proposalError } = await supabase.from("proposals").update({ status }).eq("id", proposalId);
  if (proposalError) return { ok: false, mode: "supabase", error: proposalError.message };
  const { data, error } = await supabase.from("proposals").select("*, cases(case_code,title,destination,trip_start,trip_end,clients(display_name,email)), proposal_versions(*, budget_lines(*))").eq("id", proposalId).single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

async function recalculateProposalVersion(versionId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: lines } = await supabase.from("budget_lines").select("cost_budget,sale_price").eq("proposal_version_id", versionId);
  const totalCost = (lines || []).reduce((sum, line) => sum + normalizeMoney(line.cost_budget), 0);
  const totalSale = (lines || []).reduce((sum, line) => sum + normalizeMoney(line.sale_price), 0);
  await supabase.from("proposal_versions").update({ total_cost: totalCost, total_sale: totalSale }).eq("id", versionId);
}

export async function addBudgetLineRepository(input: BudgetLineInput): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  if (!input.organization_id || !input.proposal_id) return { ok: false, mode: "supabase", error: "proposal_required" };
  const supabase = getSupabaseAdminClient();
  let versionId = input.proposal_version_id;
  if (!versionId) {
    const { data: version, error } = await supabase.from("proposal_versions").select("id").eq("proposal_id", input.proposal_id).order("version_number", { ascending: false }).limit(1).single();
    if (error) return { ok: false, mode: "supabase", error: error.message };
    versionId = version.id;
  }
  const targetVersionId = versionId;
  if (!targetVersionId) return { ok: false, mode: "supabase", error: "proposal_version_required" };

  const cost = normalizeMoney(input.cost_budget);
  const margin = normalizeMoney(input.margin_applied);
  const sale = input.sale_price !== undefined ? normalizeMoney(input.sale_price) : cost > 0 ? cost / (1 - Math.min(margin, 95) / 100) : 0;
  const { data, error } = await supabase.from("budget_lines").insert({ organization_id: input.organization_id, proposal_version_id: targetVersionId, service_type_code: input.service_type_code || "custom", description_public: input.description_public || "Servicio", supplier_name: input.supplier_name || null, cost_budget: cost, margin_applied: margin / 100, sale_price: sale }).select("*").single();
  if (error) return { ok: false, mode: "supabase", error: error.message };
  await recalculateProposalVersion(targetVersionId);
  return { ok: true, mode: "supabase", data };
}

export async function deleteBudgetLineRepository(lineId: string): Promise<RepositoryResult<{ id: string }>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const supabase = getSupabaseAdminClient();
  const { data: line } = await supabase.from("budget_lines").select("proposal_version_id").eq("id", lineId).maybeSingle();
  const { error } = await supabase.from("budget_lines").delete().eq("id", lineId);
  if (error) return { ok: false, mode: "supabase", error: error.message };
  if (line?.proposal_version_id) await recalculateProposalVersion(line.proposal_version_id as string);
  return { ok: true, mode: "supabase", data: { id: lineId } };
}

export async function listPurchasesRepository(): Promise<RepositoryResult<unknown[]>> {
  if (!canUseSupabase()) return emptyProductionResult([]);
  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").select("*").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function searchGlobalRepository(query: string): Promise<RepositoryResult<GlobalSearchResult[]>> {
  const cleaned = query.trim().slice(0, 80);
  if (!cleaned) return emptyProductionResult([]);
  if (!canUseSupabase()) return emptyProductionResult([]);

  const supabase = getSupabaseAdminClient();
  const like = `%${cleaned.replaceAll("%", "").replaceAll(",", " ")}%`;
  const results: GlobalSearchResult[] = [];

  const { data: clients } = await supabase.from("clients").select("id,display_name,email,phone").or(`display_name.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like}`).limit(8);
  for (const client of clients || []) results.push({ type: "cliente", title: client.display_name, subtitle: client.email || client.phone || "Cliente", href: "/clientes" });

  const { data: caseRows } = await supabase.from("cases").select("case_code,title,destination,status").or(`case_code.ilike.${like},title.ilike.${like},destination.ilike.${like},status.ilike.${like}`).limit(8);
  for (const item of caseRows || []) results.push({ type: "expediente", title: item.case_code, subtitle: item.title || item.destination || "Expediente", href: "/expedientes" });

  const { data: purchases } = await supabase.from("expected_purchases").select("id,supplier_name,service,status").or(`supplier_name.ilike.${like},service.ilike.${like},status.ilike.${like}`).limit(4);
  for (const item of purchases || []) results.push({ type: "compra", title: item.supplier_name, subtitle: item.service || item.status || "Compra", href: "/compras" });

  return { ok: true, mode: "supabase", data: results.slice(0, 20) };
}

export async function confirmDocumentUploadRepository(input: { organizationId: string; caseId?: string | null; ownerType: "case" | "traveler" | "supplier_invoice"; ownerId?: string | null; title: string; type: string; storagePath: string; fileName: string; mimeType: string; sizeBytes: number; checksum?: string | null; sensitivity?: "private" | "sensitive" | "public"; retentionDays?: number; actorId?: string | null }): Promise<RepositoryResult<unknown>> {
  const retentionUntil = new Date(Date.now() + (input.retentionDays || 60) * 24 * 60 * 60 * 1000).toISOString();
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("documents").insert({ organization_id: input.organizationId, case_id: input.caseId || null, owner_type: input.ownerType, owner_id: input.ownerId || null, title: input.title, type: input.type, status: "reviewing", file_name: input.fileName, storage_path: input.storagePath, mime_type: input.mimeType, size_bytes: input.sizeBytes, checksum: input.checksum || null, sensitivity: input.sensitivity || "private", retention_until: retentionUntil, access_purpose: "post_upload_confirmation", required: true }).select("*").single();
  if (error) return { ok: false, mode: "supabase", error: error.message };
  await supabase.from("document_access_log").insert({ organization_id: input.organizationId, document_id: data.id, case_id: input.caseId || null, actor_id: input.actorId || null, purpose: "post_upload_confirmed", action: "document_record_created" });
  return { ok: true, mode: "supabase", data };
}

export async function updateSettingsRepository(_: Partial<AppSetting>[]): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  return { ok: false, mode: "supabase", error: "settings_persistence_uses_api_route" };
}
