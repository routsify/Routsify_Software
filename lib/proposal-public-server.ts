import { proposal as demoProposal } from "@/lib/mock-data";
import { verifyProposalToken, hashProposalToken } from "@/lib/proposal-token";
import { isPublicDemoAllowed, isDemoMode } from "@/lib/runtime-mode";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export type PublicProposalView = typeof demoProposal;
export type PublicProposalResolution =
  | { ok: true; mode: "demo" | "supabase"; tokenHash: string; proposal: PublicProposalView; proposalId: string; versionId: string; expiresAt?: number }
  | { ok: false; reason: "invalid" | "expired" | "not_found" | "not_sent" };

function mapSupabaseProposal(input: { caseRow: Record<string, unknown>; versionRow: Record<string, unknown>; lines: Record<string, unknown>[] }): PublicProposalView {
  const total = Number(input.versionRow.total_sale || 0);
  const snapshot = typeof input.versionRow.snapshot === "object" && input.versionRow.snapshot ? input.versionRow.snapshot as Record<string, unknown> : {};
  return {
    ...demoProposal,
    client: String(input.caseRow.client_name || input.caseRow.client || snapshot.client || demoProposal.client),
    title: String(input.caseRow.title || snapshot.title || demoProposal.title),
    headline: String(snapshot.headline || "Propuesta privada preparada por Routsify."),
    destination: String(input.caseRow.destination || snapshot.destination || demoProposal.destination),
    dates: `${String(input.caseRow.trip_start || "fecha pendiente")} → ${String(input.caseRow.trip_end || "fecha pendiente")}`,
    travelers: String(snapshot.travelers || demoProposal.travelers),
    total,
    highlights: Array.isArray(snapshot.highlights) ? snapshot.highlights.map(String) : demoProposal.highlights,
    itinerary: Array.isArray(snapshot.itinerary) ? snapshot.itinerary as [string, string][] : demoProposal.itinerary,
    lines: input.lines.length ? input.lines.map((line) => [String(line.service_type_code || "Servicio"), String(line.description_public || "Servicio incluido"), Number(line.sale_price || 0)] as [string, string, number]) : demoProposal.lines,
  };
}

export async function resolvePublicProposal(token: string): Promise<PublicProposalResolution> {
  if (token === "demo-public-token" && isPublicDemoAllowed()) {
    return { ok: true, mode: "demo", tokenHash: hashProposalToken(token), proposal: demoProposal, proposalId: "demo-proposal", versionId: "demo-version" };
  }

  try {
    const payload = verifyProposalToken(token);
    const tokenHash = hashProposalToken(token);

    if (isDemoMode() || !hasSupabaseAdminEnv()) {
      return { ok: true, mode: "demo", tokenHash, proposal: demoProposal, proposalId: payload.proposalId, versionId: payload.versionId, expiresAt: payload.exp };
    }

    const supabase = getSupabaseAdminClient();
    const { data: proposalRow, error: proposalError } = await supabase
      .from("proposals")
      .select("id,status,case_id,public_token_hash,public_token_expires_at")
      .eq("id", payload.proposalId)
      .eq("public_token_hash", tokenHash)
      .single();

    if (proposalError || !proposalRow) return { ok: false, reason: "not_found" };
    if (proposalRow.public_token_expires_at && new Date(proposalRow.public_token_expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
    if (!["sent", "internal_review"].includes(String(proposalRow.status))) return { ok: false, reason: "not_sent" };

    const { data: versionRow, error: versionError } = await supabase
      .from("proposal_versions")
      .select("id,proposal_id,version_number,status,total_sale,total_cost,locked,snapshot,expires_at")
      .eq("id", payload.versionId)
      .eq("proposal_id", payload.proposalId)
      .single();
    if (versionError || !versionRow) return { ok: false, reason: "not_found" };
    if (!["sent", "accepted", "internal_review"].includes(String(versionRow.status))) return { ok: false, reason: "not_sent" };

    const { data: caseRow } = await supabase.from("cases").select("id,title,destination,trip_start,trip_end,accepted_value").eq("id", proposalRow.case_id).single();
    const { data: lines } = await supabase.from("budget_lines").select("service_type_code,description_public,sale_price").eq("proposal_version_id", payload.versionId).order("created_at", { ascending: true });

    return { ok: true, mode: "supabase", tokenHash, proposal: mapSupabaseProposal({ caseRow: caseRow || {}, versionRow, lines: lines || [] }), proposalId: payload.proposalId, versionId: payload.versionId, expiresAt: payload.exp };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid";
    if (message === "token_expired") return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}
