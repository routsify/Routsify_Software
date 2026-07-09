import { NextRequest, NextResponse } from "next/server";
import { resolvePublicProposal } from "@/lib/proposal-public-server";

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const resolved = await resolvePublicProposal(token);
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.reason }, { status: resolved.reason === "expired" ? 410 : 404 });
  return NextResponse.json({ ok: true, mode: resolved.mode, proposalId: resolved.proposalId, versionId: resolved.versionId });
}
