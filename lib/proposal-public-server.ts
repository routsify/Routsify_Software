import { verifyProposalToken, hashProposalToken } from "@/lib/proposal-token";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

const DEFAULT_PROPOSAL_TERMS = "La aceptación confirma la conformidad con los servicios, fechas e importes mostrados en esta versión. Routsify preparará el contrato, solicitará la documentación necesaria y coordinará los pagos y reservas correspondientes conforme a las condiciones contractuales aplicables.";

export type PublicProposalView = {
  client: string;
  clientEmail?: string | null;
  title: string;
  headline: string;
  destination: string;
  dates: string;
  travelers: string;
  total: number;
  highlights: string[];
  itinerary: [string, string][];
  lines: [string, string, number][];
  terms: string;
};

export type PublicProposalResolution =
  | { ok: true; mode: "supabase"; tokenHash: string; proposal: PublicProposalView; proposalId: string; versionId: string; organizationId: string; status: string; accepted: boolean; expiresAt?: number }
  | { ok: false; reason: "invalid" | "expired" | "not_found" | "not_sent" };

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : fallback;
}

function itineraryArray(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Array.isArray(item) ? [String(item[0] || "Etapa"), String(item[1] || "Detalle pendiente")] as [string, string] : null).filter(Boolean) as [string, string][];
}

function mapSupabaseProposal(input: { caseRow: Record<string, unknown>; versionRow: Record<string, unknown>; lines: Record<string, unknown>[] }): PublicProposalView {
  const total = Number(input.versionRow.total_sale || 0);
  const snapshot = typeof input.versionRow.snapshot === "object" && input.versionRow.snapshot ? input.versionRow.snapshot as Record<string, unknown> : {};
  const rawClient = input.caseRow.clients;
  const clientRecord = Array.isArray(rawClient) ? (rawClient[0] || {}) as Record<string, unknown> : typeof rawClient === "object" && rawClient ? rawClient as Record<string, unknown> : {};
  const title = String(input.caseRow.title || snapshot.title || "Propuesta de viaje Routsify");
  const destination = String(input.caseRow.destination || snapshot.destination || "Destino pendiente");
  const start = input.caseRow.trip_start ? new Date(String(input.caseRow.trip_start)).toLocaleDateString("es-ES") : "fecha pendiente";
  const end = input.caseRow.trip_end ? new Date(String(input.caseRow.trip_end)).toLocaleDateString("es-ES") : "fecha pendiente";

  return {
    client: String(clientRecord.display_name || snapshot.client || "Cliente Routsify"),
    clientEmail: clientRecord.email ? String(clientRecord.email) : null,
    title,
    headline: String(snapshot.headline || "Propuesta privada preparada por Routsify."),
    destination,
    dates: `${start} → ${end}`,
    travelers: String(snapshot.travelers || "Viajeros por confirmar"),
    total,
    highlights: stringArray(snapshot.highlights, []),
    itinerary: itineraryArray(snapshot.itinerary),
    lines: input.lines.map((line) => [String(line.service_type_code || "Servicio"), String(line.description_public || "Servicio incluido"), Number(line.sale_price || 0)] as [string, string, number]),
    terms: String(input.versionRow.terms_snapshot || DEFAULT_PROPOSAL_TERMS),
  };
}

export async function resolvePublicProposal(token: string): Promise<PublicProposalResolution> {
  if (!hasSupabaseAdminEnv()) return { ok: false, reason: "not_found" };
  try {
    const payload = verifyProposalToken(token);
    const tokenHash = hashProposalToken(token);
    const supabase = getSupabaseAdminClient();
    const { data: proposalRow, error: proposalError } = await supabase
      .from("proposals")
      .select("id,status,case_id,organization_id,public_token_hash,public_token_expires_at")
      .eq("id", payload.proposalId)
      .eq("public_token_hash", tokenHash)
      .single();

    if (proposalError || !proposalRow) return { ok: false, reason: "not_found" };
    const accepted = String(proposalRow.status) === "accepted";
    if (!accepted && proposalRow.public_token_expires_at && new Date(proposalRow.public_token_expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
    if (!["sent", "internal_review", "accepted"].includes(String(proposalRow.status))) return { ok: false, reason: "not_sent" };

    const { data: versionRow, error: versionError } = await supabase
      .from("proposal_versions")
      .select("id,proposal_id,version_number,status,total_sale,total_cost,locked,snapshot,terms_snapshot,expires_at")
      .eq("id", payload.versionId)
      .eq("proposal_id", payload.proposalId)
      .single();
    if (versionError || !versionRow) return { ok: false, reason: "not_found" };
    if (!["sent", "accepted", "internal_review"].includes(String(versionRow.status))) return { ok: false, reason: "not_sent" };

    const { data: caseRow } = await supabase.from("cases").select("id,title,destination,trip_start,trip_end,accepted_value,clients(display_name,email)").eq("id", proposalRow.case_id).single();
    const { data: lines } = await supabase.from("budget_lines").select("service_type_code,description_public,sale_price").eq("proposal_version_id", payload.versionId).eq("included", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true });

    return { ok: true, mode: "supabase", tokenHash, proposal: mapSupabaseProposal({ caseRow: caseRow || {}, versionRow, lines: lines || [] }), proposalId: payload.proposalId, versionId: payload.versionId, organizationId: String(proposalRow.organization_id), status: String(proposalRow.status), accepted, expiresAt: payload.exp };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid";
    if (message === "token_expired") return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}
