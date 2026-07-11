import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePublicProposal } from "@/lib/proposal-public-server";

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const resolved = await resolvePublicProposal(token);
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.reason }, { status: resolved.reason === "expired" ? 410 : 404 });

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("accept_proposal_version", { target_version: resolved.versionId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: "supabase", proposalId: resolved.proposalId, versionId: resolved.versionId });
}
