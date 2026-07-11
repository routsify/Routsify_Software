import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import type { GlobalSearchResult, RepositoryResult } from "@/lib/server-repositories";

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

export async function searchOrganization(organizationId: string, query: string): Promise<RepositoryResult<GlobalSearchResult[]>> {
  const cleaned = query.trim().slice(0, 80).replaceAll("%", "").replaceAll(",", " ");
  if (!cleaned) return { ok: true, mode: "supabase", data: [] };
  if (!hasSupabaseAdminEnv()) return unavailable();

  const supabase = getSupabaseAdminClient();
  const like = `%${cleaned}%`;
  const results: GlobalSearchResult[] = [];

  const [{ data: clients }, { data: cases }, { data: proposals }, { data: purchases }] = await Promise.all([
    supabase.from("clients").select("id,display_name,email,phone").eq("organization_id", organizationId).or(`display_name.ilike.${like},email.ilike.${like},phone.ilike.${like},tax_id.ilike.${like}`).limit(8),
    supabase.from("cases").select("id,case_code,title,destination,status").eq("organization_id", organizationId).or(`case_code.ilike.${like},title.ilike.${like},destination.ilike.${like}`).limit(8),
    supabase.from("proposals").select("id,status,cases(case_code,title,clients(display_name))").eq("organization_id", organizationId).limit(50),
    supabase.from("expected_purchases").select("id,supplier_name,service,status,cases(case_code)").eq("organization_id", organizationId).or(`supplier_name.ilike.${like},service.ilike.${like}`).limit(8),
  ]);

  for (const client of clients || []) results.push({ type: "cliente", title: client.display_name, subtitle: client.email || client.phone || "Cliente", href: `/clientes?clientId=${client.id}` });
  for (const item of cases || []) results.push({ type: "expediente", title: item.case_code, subtitle: item.title || item.destination || "Expediente", href: `/expedientes?caseId=${item.id}` });
  for (const proposal of proposals || []) {
    const caseRow = Array.isArray(proposal.cases) ? proposal.cases[0] : proposal.cases;
    const haystack = [caseRow?.case_code, caseRow?.title, caseRow?.clients?.display_name, proposal.status].filter(Boolean).join(" ").toLowerCase();
    if (haystack.includes(cleaned.toLowerCase())) results.push({ type: "presupuesto", title: caseRow?.case_code || "Presupuesto", subtitle: `${caseRow?.clients?.display_name || caseRow?.title || "Expediente"} · ${proposal.status}`, href: `/propuestas?proposalId=${proposal.id}` });
  }
  for (const item of purchases || []) {
    const caseRow = Array.isArray(item.cases) ? item.cases[0] : item.cases;
    results.push({ type: "compra", title: item.supplier_name || "Compra", subtitle: `${caseRow?.case_code || "Sin expediente"} · ${item.service || item.status || "Compra"}`, href: `/compras?purchaseId=${item.id}` });
  }

  return { ok: true, mode: "supabase", data: results.slice(0, 30) };
}
