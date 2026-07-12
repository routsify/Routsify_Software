import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import type { GlobalSearchResult, RepositoryResult } from "@/lib/server-repositories";

function unavailable<T>(): RepositoryResult<T> {
  return { ok: false, mode: "supabase", error: "supabase_admin_not_configured" };
}

function oneRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
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
    .select("*, cases(id,case_code,title,destination,trip_start,trip_end,clients(display_name,email)), proposal_versions(*, budget_lines(*), payment_links(*))")
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
    supabase.from("proposals").select("id,status,cases(id,case_code,title,clients(display_name))").eq("organization_id", organizationId).limit(50),
    supabase.from("expected_purchases").select("id,supplier_name,service,status,cases(case_code)").eq("organization_id", organizationId).or(`supplier_name.ilike.${like},service.ilike.${like}`).limit(8),
  ]);

  for (const client of clients || []) results.push({ type: "cliente", title: String(client.display_name || "Cliente"), subtitle: String(client.email || client.phone || "Cliente"), href: "/clientes" });
  for (const item of cases || []) results.push({ type: "expediente", title: String(item.case_code || "Expediente"), subtitle: String(item.title || item.destination || "Expediente"), href: `/expedientes?caseId=${item.id}` });

  for (const rawProposal of proposals || []) {
    const proposal = rawProposal as Record<string, unknown>;
    const caseRow = oneRecord(proposal.cases);
    const clientRow = oneRecord(caseRow?.clients);
    const haystack = [caseRow?.case_code, caseRow?.title, clientRow?.display_name, proposal.status].filter(Boolean).join(" ").toLowerCase();
    if (haystack.includes(cleaned.toLowerCase())) {
      results.push({
        type: "presupuesto",
        title: String(caseRow?.case_code || "Presupuesto"),
        subtitle: `${String(clientRow?.display_name || caseRow?.title || "Expediente")} · ${String(proposal.status || "draft")}`,
        href: caseRow?.id ? `/propuestas?caseId=${caseRow.id}` : "/propuestas",
      });
    }
  }

  for (const rawPurchase of purchases || []) {
    const purchase = rawPurchase as Record<string, unknown>;
    const caseRow = oneRecord(purchase.cases);
    results.push({
      type: "compra",
      title: String(purchase.supplier_name || "Compra"),
      subtitle: `${String(caseRow?.case_code || "Sin expediente")} · ${String(purchase.service || purchase.status || "Compra")}`,
      href: "/compras",
    });
  }

  return { ok: true, mode: "supabase", data: results.slice(0, 30) };
}
