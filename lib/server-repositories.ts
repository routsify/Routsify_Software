import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { isDemoMode } from "@/lib/runtime-mode";
import { demoClientMasters, createDemoClient, type ClientMaster, type ClientOrigin } from "@/lib/client-master";
import { cases } from "@/lib/mock-data";
import { demoExpectedPurchases } from "@/lib/purchase-master";
import { demoSettings, updateSettingsDemo, type AppSetting } from "@/lib/settings-master";

export type RepositoryMode = "demo" | "supabase";
export type RepositoryResult<T> = { ok: true; mode: RepositoryMode; data: T } | { ok: false; mode: RepositoryMode; error: string };

export type GlobalSearchResult = {
  type: "cliente" | "expediente" | "presupuesto" | "compra";
  title: string;
  subtitle: string;
  href: string;
};

type ClientRepositoryInput = Partial<ClientMaster> & { organization_id?: string; name?: string };

function canUseSupabase() {
  return !isDemoMode() && hasSupabaseAdminEnv();
}

function originFrom(value: unknown): ClientOrigin {
  return ["Web", "Fillout", "Booking", "Referral", "Agencia", "Manual"].includes(String(value)) ? String(value) as ClientOrigin : "Manual";
}

function emptyProductionResult<T>(data: T): RepositoryResult<T> {
  return { ok: true, mode: "supabase", data };
}

export function repositoryMode(): RepositoryMode {
  return canUseSupabase() ? "supabase" : isDemoMode() ? "demo" : "supabase";
}

export async function listClientsRepository(): Promise<RepositoryResult<unknown[]>> {
  if (isDemoMode()) return { ok: true, mode: "demo", data: demoClientMasters };
  if (!canUseSupabase()) return emptyProductionResult([]);
  const { data, error } = await getSupabaseAdminClient().from("clients").select("*").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function createClientRepository(input: ClientRepositoryInput): Promise<RepositoryResult<unknown>> {
  if (isDemoMode()) return { ok: true, mode: "demo", data: createDemoClient({ display_name: input.display_name || input.name || "Cliente sin nombre", email: input.email || "", phone: input.phone || "", origin: originFrom(input.origin || input.source), owner: input.owner || "Equipo", tax_id: input.tax_id || "", billing_address: String(input.billing_address || ""), fiscal_email: input.fiscal_email || input.email || "" }) };
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
  if (isDemoMode()) return { ok: true, mode: "demo", data: cases };
  if (!canUseSupabase()) return emptyProductionResult([]);
  const { data, error } = await getSupabaseAdminClient().from("cases").select("*, clients(display_name,email,phone,holded_contact_id)").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function createTimelineEventRepository(input: { organizationId: string; caseId?: string | null; clientId?: string | null; eventType: string; title: string; payload?: Record<string, unknown>; createdBy?: string | null }): Promise<RepositoryResult<unknown>> {
  if (isDemoMode()) return { ok: true, mode: "demo", data: { ...input, id: `demo-${Date.now()}` } };
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const { data, error } = await getSupabaseAdminClient().from("timeline_events").insert({ organization_id: input.organizationId, case_id: input.caseId || null, client_id: input.clientId || null, event_type: input.eventType, title: input.title, payload: input.payload || {}, created_by: input.createdBy || null }).select("*").single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function listPurchasesRepository(): Promise<RepositoryResult<unknown[]>> {
  if (isDemoMode()) return { ok: true, mode: "demo", data: demoExpectedPurchases };
  if (!canUseSupabase()) return emptyProductionResult([]);
  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").select("*").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function searchGlobalRepository(query: string): Promise<RepositoryResult<GlobalSearchResult[]>> {
  const cleaned = query.trim().slice(0, 80);
  if (!cleaned) return emptyProductionResult([]);
  if (isDemoMode()) {
    const needle = cleaned.toLowerCase();
    const clientResults = demoClientMasters.filter((client) => [client.display_name, client.email, client.phone].join(" ").toLowerCase().includes(needle)).map((client) => ({ type: "cliente" as const, title: client.display_name, subtitle: client.email || client.phone || "Cliente", href: "/clientes" }));
    const caseResults = cases.filter((item) => [item.case_code, item.client, item.destination, item.title].join(" ").toLowerCase().includes(needle)).map((item) => ({ type: "expediente" as const, title: item.case_code, subtitle: `${item.client} · ${item.destination || "Expediente"}`, href: `/expedientes/${item.case_code}` }));
    return { ok: true, mode: "demo", data: [...clientResults, ...caseResults].slice(0, 20) };
  }
  if (!canUseSupabase()) return emptyProductionResult([]);

  const supabase = getSupabaseAdminClient();
  const like = `%${cleaned.replaceAll("%", "").replaceAll(",", " ")}%`;
  const results: GlobalSearchResult[] = [];

  const { data: clients } = await supabase.from("clients").select("id,display_name,email,phone").or(`display_name.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like}`).limit(8);
  for (const client of clients || []) results.push({ type: "cliente", title: client.display_name, subtitle: client.email || client.phone || "Cliente", href: "/clientes" });

  const { data: caseRows } = await supabase.from("cases").select("case_code,title,destination,status").or(`case_code.ilike.${like},title.ilike.${like},destination.ilike.${like},status.ilike.${like}`).limit(8);
  for (const item of caseRows || []) results.push({ type: "expediente", title: item.case_code, subtitle: item.title || item.destination || "Expediente", href: `/expedientes/${item.case_code}` });

  const { data: purchases } = await supabase.from("expected_purchases").select("id,supplier_name,service,status").or(`supplier_name.ilike.${like},service.ilike.${like},status.ilike.${like}`).limit(4);
  for (const item of purchases || []) results.push({ type: "compra", title: item.supplier_name, subtitle: item.service || item.status || "Compra", href: "/compras" });

  return { ok: true, mode: "supabase", data: results.slice(0, 20) };
}

export async function confirmDocumentUploadRepository(input: { organizationId: string; caseId?: string | null; ownerType: "case" | "traveler" | "supplier_invoice"; ownerId?: string | null; title: string; type: string; storagePath: string; fileName: string; mimeType: string; sizeBytes: number; checksum?: string | null; sensitivity?: "private" | "sensitive" | "public"; retentionDays?: number; actorId?: string | null }): Promise<RepositoryResult<unknown>> {
  const retentionUntil = new Date(Date.now() + (input.retentionDays || 60) * 24 * 60 * 60 * 1000).toISOString();
  if (isDemoMode()) return { ok: true, mode: "demo", data: { ...input, status: "reviewing", retention_until: retentionUntil } };
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("documents").insert({ organization_id: input.organizationId, case_id: input.caseId || null, owner_type: input.ownerType, owner_id: input.ownerId || null, title: input.title, type: input.type, status: "reviewing", file_name: input.fileName, storage_path: input.storagePath, mime_type: input.mimeType, size_bytes: input.sizeBytes, checksum: input.checksum || null, sensitivity: input.sensitivity || "private", retention_until: retentionUntil, access_purpose: "post_upload_confirmation", required: true }).select("*").single();
  if (error) return { ok: false, mode: "supabase", error: error.message };
  await supabase.from("document_access_log").insert({ organization_id: input.organizationId, document_id: data.id, case_id: input.caseId || null, actor_id: input.actorId || null, purpose: "post_upload_confirmed", action: "document_record_created" });
  return { ok: true, mode: "supabase", data };
}

export async function updateSettingsRepository(updates: Partial<AppSetting>[]): Promise<RepositoryResult<unknown>> {
  if (isDemoMode()) return { ok: true, mode: "demo", data: updateSettingsDemo(demoSettings, updates) };
  if (!canUseSupabase()) return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
  return { ok: false, mode: "supabase", error: "settings_persistence_pending" };
}
