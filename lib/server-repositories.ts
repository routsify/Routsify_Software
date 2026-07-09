import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { isDemoMode } from "@/lib/runtime-mode";
import { demoClientMasters, createDemoClient, type ClientMaster } from "@/lib/client-master";
import { cases } from "@/lib/mock-data";
import { demoExpectedPurchases } from "@/lib/purchase-master";
import { demoSettings, updateSettingsDemo, type AppSetting } from "@/lib/settings-master";

export type RepositoryMode = "demo" | "supabase";
export type RepositoryResult<T> = { ok: true; mode: RepositoryMode; data: T } | { ok: false; mode: RepositoryMode; error: string };

function canUseSupabase() {
  return !isDemoMode() && hasSupabaseAdminEnv();
}

export function repositoryMode(): RepositoryMode {
  return canUseSupabase() ? "supabase" : "demo";
}

export async function listClientsRepository(): Promise<RepositoryResult<unknown[]>> {
  if (!canUseSupabase()) return { ok: true, mode: "demo", data: demoClientMasters };
  const { data, error } = await getSupabaseAdminClient().from("clients").select("*").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function createClientRepository(input: Partial<ClientMaster>): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: true, mode: "demo", data: createDemoClient(input) };
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").replace(/\D/g, "");
  const payload = {
    organization_id: input.organization_id,
    display_name: input.display_name || input.name || "Cliente sin nombre",
    email,
    email_normalized: email || null,
    phone: input.phone || null,
    phone_normalized: phone || null,
    source: input.origin || input.source || "manual",
    tax_id: input.tax_id || null,
    notes: input.notes || null,
  };
  const { data, error } = await getSupabaseAdminClient().from("clients").upsert(payload, { onConflict: "organization_id,email_normalized" }).select("*").single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function listCasesRepository(): Promise<RepositoryResult<unknown[]>> {
  if (!canUseSupabase()) return { ok: true, mode: "demo", data: cases };
  const { data, error } = await getSupabaseAdminClient().from("cases").select("*, clients(display_name,email,phone,holded_contact_id)").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function createTimelineEventRepository(input: { organizationId: string; caseId?: string | null; clientId?: string | null; eventType: string; title: string; payload?: Record<string, unknown>; createdBy?: string | null }): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: true, mode: "demo", data: { ...input, id: `demo-${Date.now()}` } };
  const { data, error } = await getSupabaseAdminClient().from("timeline_events").insert({ organization_id: input.organizationId, case_id: input.caseId || null, client_id: input.clientId || null, event_type: input.eventType, title: input.title, payload: input.payload || {}, created_by: input.createdBy || null }).select("*").single();
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data };
}

export async function listPurchasesRepository(): Promise<RepositoryResult<unknown[]>> {
  if (!canUseSupabase()) return { ok: true, mode: "demo", data: demoExpectedPurchases };
  const { data, error } = await getSupabaseAdminClient().from("expected_purchases").select("*").order("created_at", { ascending: false }).limit(100);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function confirmDocumentUploadRepository(input: { organizationId: string; caseId?: string | null; ownerType: "case" | "traveler" | "supplier_invoice"; ownerId?: string | null; title: string; type: string; storagePath: string; fileName: string; mimeType: string; sizeBytes: number; checksum?: string | null; sensitivity?: "private" | "sensitive" | "public"; retentionDays?: number; actorId?: string | null }): Promise<RepositoryResult<unknown>> {
  const retentionUntil = new Date(Date.now() + (input.retentionDays || 60) * 24 * 60 * 60 * 1000).toISOString();
  if (!canUseSupabase()) return { ok: true, mode: "demo", data: { ...input, status: "reviewing", retention_until: retentionUntil } };
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("documents").insert({ organization_id: input.organizationId, case_id: input.caseId || null, owner_type: input.ownerType, owner_id: input.ownerId || null, title: input.title, type: input.type, status: "reviewing", file_name: input.fileName, storage_path: input.storagePath, mime_type: input.mimeType, size_bytes: input.sizeBytes, checksum: input.checksum || null, sensitivity: input.sensitivity || "private", retention_until: retentionUntil, access_purpose: "post_upload_confirmation", required: true }).select("*").single();
  if (error) return { ok: false, mode: "supabase", error: error.message };
  await supabase.from("document_access_log").insert({ organization_id: input.organizationId, document_id: data.id, case_id: input.caseId || null, actor_id: input.actorId || null, purpose: "post_upload_confirmed", action: "document_record_created" });
  return { ok: true, mode: "supabase", data };
}

export async function updateSettingsRepository(updates: Partial<AppSetting>[]): Promise<RepositoryResult<unknown>> {
  if (!canUseSupabase()) return { ok: true, mode: "demo", data: updateSettingsDemo(demoSettings, updates) };
  return { ok: false, mode: "supabase", error: "settings_table_not_enabled_yet_use_migration_0005" };
}
