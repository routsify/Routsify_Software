import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePublicProposal } from "@/lib/proposal-public-server";

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

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
  const { data: proposal } = await supabase.from("proposals").select("organization_id,case_id").eq("id", resolved.proposalId).single();
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });

  const { data: existing } = await supabase.from("proposal_acceptances").select("id,accepted_at,acceptor_name").eq("proposal_version_id", resolved.versionId).maybeSingle();
  if (existing || resolved.accepted) return NextResponse.json({ ok: true, already_accepted: true, message: "Esta propuesta ya estaba aceptada.", acceptance: existing || null });

  const { error: acceptError } = await supabase.rpc("accept_proposal_version", { target_version: resolved.versionId });
  if (acceptError) return NextResponse.json({ ok: false, error: acceptError.message }, { status: 400 });

  const acceptedAt = new Date().toISOString();
  const { data: acceptance, error: evidenceError } = await supabase.from("proposal_acceptances").insert({
    organization_id: proposal.organization_id,
    proposal_id: resolved.proposalId,
    proposal_version_id: resolved.versionId,
    case_id: proposal.case_id,
    acceptor_name: acceptorName,
    acceptor_email: acceptorEmail || resolved.proposal.clientEmail || null,
    terms_accepted: true,
    ip_hash: createHash("sha256").update(requestIp(request)).digest("hex"),
    user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    accepted_at: acceptedAt,
  }).select("id,accepted_at,acceptor_name").single();
  if (evidenceError) return NextResponse.json({ ok: false, error: evidenceError.message }, { status: 400 });

  const { data: currentContract } = await supabase.from("contracts").select("id").eq("organization_id", proposal.organization_id).eq("case_id", proposal.case_id).limit(1).maybeSingle();
  if (!currentContract) await supabase.from("contracts").insert({ organization_id: proposal.organization_id, case_id: proposal.case_id, title: "Contrato de viaje", status: "draft", notes: "Creado automáticamente tras la aceptación del presupuesto." });
  await supabase.from("tasks").insert({ organization_id: proposal.organization_id, case_id: proposal.case_id, title: "Preparar contrato y solicitar documentación", status: "pending", priority: "high", due_at: new Date(Date.now() + 86400000).toISOString(), payload: { source: "proposal_acceptance", proposal_id: resolved.proposalId, version_id: resolved.versionId } });
  await supabase.from("timeline_events").insert({ organization_id: proposal.organization_id, case_id: proposal.case_id, event_type: "proposal.accepted_publicly", title: `Presupuesto aceptado por ${acceptorName}`, payload: { proposal_id: resolved.proposalId, version_id: resolved.versionId, acceptance_id: acceptance.id, accepted_at: acceptedAt } });

  return NextResponse.json({ ok: true, proposalId: resolved.proposalId, versionId: resolved.versionId, acceptance, message: "Propuesta aceptada correctamente. Routsify continuará con contrato, documentación y reservas." });
}
