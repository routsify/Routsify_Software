import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePublicProposal } from "@/lib/proposal-public-server";

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

type AcceptanceRpcResult = {
  already_accepted?: boolean;
  acceptance?: { id: string; accepted_at: string; acceptor_name: string } | null;
};

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);
  const acceptorName = String(body?.acceptor_name || "").trim();
  const acceptorEmail = String(body?.acceptor_email || "").trim().toLowerCase();
  const termsAccepted = body?.terms_accepted === true;

  if (acceptorName.length < 2) return NextResponse.json({ ok: false, error: "acceptor_name_required" }, { status: 400 });
  if (acceptorEmail && !/^\S+@\S+\.\S+$/.test(acceptorEmail)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  if (!termsAccepted) return NextResponse.json({ ok: false, error: "terms_required" }, { status: 400 });

  const resolved = await resolvePublicProposal(token);
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.reason }, { status: resolved.reason === "expired" ? 410 : 404 });
  const supabase = getSupabaseAdminClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("accept_public_proposal_version", {
    target_version: resolved.versionId,
    acceptor_name_value: acceptorName,
    acceptor_email_value: acceptorEmail || resolved.proposal.clientEmail || "",
    ip_hash_value: createHash("sha256").update(requestIp(request)).digest("hex"),
    user_agent_value: request.headers.get("user-agent") || "",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const result = (data || {}) as AcceptanceRpcResult;

  return NextResponse.json({
    ok: true,
    proposalId: resolved.proposalId,
    versionId: resolved.versionId,
    acceptance: result.acceptance || null,
    already_accepted: result.already_accepted === true,
    message: result.already_accepted === true ? "Esta propuesta ya estaba aceptada." : "Propuesta aceptada correctamente. Routsify continuará con contrato, documentación y reservas.",
  });
}
