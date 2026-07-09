import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { hashProposalToken, verifyProposalToken } from "@/lib/proposal-token";
import { resolvePublicProposal } from "@/lib/proposal-public-server";

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  if (!hasSupabaseAdminEnv() || !process.env.PROPOSAL_TOKEN_SECRET) {
    const resolved = resolvePublicProposal(token);
    if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.reason }, { status: resolved.reason === "expired" ? 410 : 404 });
    return NextResponse.json({ ok: true, mode: resolved.mode, message: "Aceptación demo registrada localmente." });
  }

  try {
    const payload = verifyProposalToken(token);
    const supabase = getSupabaseAdminClient();
    const tokenHash = hashProposalToken(token);

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, public_token_hash, public_token_expires_at")
      .eq("id", payload.proposalId)
      .eq("public_token_hash", tokenHash)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
    }

    if (proposal.public_token_expires_at && new Date(proposal.public_token_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "token_expired" }, { status: 410 });
    }

    const { error: rpcError } = await supabase.rpc("accept_proposal_version", { target_version: payload.versionId });
    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, mode: "real", message: "Propuesta aceptada y versión bloqueada." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "invalid_request" }, { status: 400 });
  }
}
