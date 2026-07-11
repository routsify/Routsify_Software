import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import type { RepositoryResult } from "@/lib/server-repositories";

function unavailable<T>(): RepositoryResult<T> {
  return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
}

export async function listOrganizationClients(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient()
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function listOrganizationCases(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient()
    .from("cases")
    .select("*, clients(display_name,email,phone,holded_contact_id)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function listOrganizationProposals(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient()
    .from("proposals")
    .select("*, cases(id,case_code,title,destination,trip_start,trip_end,clients(display_name,email)), proposal_versions(*, budget_lines(*))")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}

export async function listOrganizationPurchases(organizationId: string): Promise<RepositoryResult<unknown[]>> {
  if (!hasSupabaseAdminEnv()) return unavailable();
  const { data, error } = await getSupabaseAdminClient()
    .from("expected_purchases")
    .select("*, cases(case_code,title)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  return error ? { ok: false, mode: "supabase", error: error.message } : { ok: true, mode: "supabase", data: data || [] };
}
