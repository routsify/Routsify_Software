import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { PROPOSAL_WITH_VERSIONS_SELECT } from "@/lib/query-selects";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedStatuses = new Set(["draft", "internal_review", "sent", "accepted", "rejected"]);
const versionStatus: Record<string, string> = {
  draft: "draft",
  internal_review: "internal_review",
  sent: "sent",
  rejected: "lost",
};
const caseStatus: Record<string, { status: string; next_action: string }> = {
  draft: { status: "budget_draft", next_action: "Completar presupuesto" },
  internal_review: { status: "budget_draft", next_action: "Revisar presupuesto internamente" },
  sent: { status: "proposal_sent", next_action: "Hacer seguimiento al cliente" },
  rejected: { status: "call_done", next_action: "Replantear propuesta o cerrar oportunidad" },
};

async function fullProposal(proposalId: string, organizationId: string) {
  return getSupabaseAdminClient()
    .from("proposals")
    .select(PROPOSAL_WITH_VERSIONS_SELECT)
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .single();
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "");
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });

  const organizationId = access.organizationId;
  const supabase = getSupabaseAdminClient();
  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id,case_id,organization_id,status,current_version_id")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (proposalError) return NextResponse.json({ ok: false, error: proposalError.message }, { status: 400 });
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });

  if (proposal.status === "accepted" && status !== "accepted") {
    return NextResponse.json({ ok: false, error: "accepted_proposal_locked" }, { status: 409 });
  }

  const { data: version, error: versionError } = await supabase
    .from("proposal_versions")
    .select("id,total_sale,locked,status")
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 400 });
  if (!version) return NextResponse.json({ ok: false, error: "proposal_version_not_found" }, { status: 400 });

  if (status === "accepted") {
    if (Number(version.total_sale || 0) <= 0) return NextResponse.json({ ok: false, error: "proposal_total_required" }, { status: 400 });
    const { count, error: lineError } = await supabase.from("budget_lines").select("id", { count: "exact", head: true }).eq("proposal_version_id", version.id);
    if (lineError) return NextResponse.json({ ok: false, error: lineError.message }, { status: 400 });
    if (!count) return NextResponse.json({ ok: false, error: "proposal_requires_lines" }, { status: 400 });

    const { error: acceptError } = await supabase.rpc("accept_proposal_version", { target_version: version.id });
    if (acceptError) return NextResponse.json({ ok: false, error: acceptError.message }, { status: 400 });

    const { data: existingContract } = await supabase.from("contracts").select("id").eq("organization_id", organizationId).eq("case_id", proposal.case_id).limit(1).maybeSingle();
    if (!existingContract) {
      await supabase.from("contracts").insert({
        organization_id: organizationId,
        case_id: proposal.case_id,
        title: "Contrato de viaje",
        status: "draft",
        notes: "Creado automáticamente tras registrar la aceptación manual del presupuesto.",
      });
    }
    await supabase.from("tasks").upsert({
      organization_id: organizationId,
      case_id: proposal.case_id,
      title: "Preparar contrato y solicitar documentación",
      status: "pending",
      priority: "high",
      due_at: new Date(Date.now() + 86400000).toISOString(),
      idempotency_key: `manual_acceptance_followup:${proposalId}:${version.id}`,
      payload: { source: "manual_proposal_acceptance", proposal_id: proposalId, version_id: version.id },
    }, { onConflict: "organization_id,idempotency_key" });

    const { data, error } = await fullProposal(proposalId, organizationId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, mode: "supabase", data });
  }

  if (["internal_review", "sent"].includes(status)) {
    const { count, error: lineError } = await supabase.from("budget_lines").select("id", { count: "exact", head: true }).eq("proposal_version_id", version.id);
    if (lineError) return NextResponse.json({ ok: false, error: lineError.message }, { status: 400 });
    if (!count) return NextResponse.json({ ok: false, error: "proposal_requires_lines" }, { status: 400 });
  }

  if (version.locked || version.status === "accepted") {
    return NextResponse.json({ ok: false, error: "accepted_version_locked" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: updateProposalError } = await supabase.from("proposals").update({ status, updated_at: now }).eq("id", proposalId).eq("organization_id", organizationId);
  if (updateProposalError) return NextResponse.json({ ok: false, error: updateProposalError.message }, { status: 400 });

  const { error: updateVersionError } = await supabase.from("proposal_versions").update({ status: versionStatus[status] }).eq("id", version.id).eq("organization_id", organizationId);
  if (updateVersionError) return NextResponse.json({ ok: false, error: updateVersionError.message }, { status: 400 });

  const workflow = caseStatus[status];
  if (workflow) {
    const { error: updateCaseError } = await supabase.from("cases").update({ status: workflow.status, next_action: workflow.next_action, updated_at: now }).eq("id", proposal.case_id).eq("organization_id", organizationId);
    if (updateCaseError) return NextResponse.json({ ok: false, error: updateCaseError.message }, { status: 400 });
  }

  const { data, error } = await fullProposal(proposalId, organizationId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: "supabase", data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { proposalId } = await params;
  const organizationId = access.organizationId;
  const db = getSupabaseAdminClient();
  const { data: proposal, error: proposalError } = await db.from("proposals")
    .select("id,status")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (proposalError) return NextResponse.json({ ok: false, error: proposalError.message }, { status: 400 });
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  const { data, error } = await db.rpc("delete_unaccepted_proposal", {
    target_org: organizationId,
    target_proposal: proposalId,
    actor: access.actorId,
  });
  if (error) {
    const protectedHistory = ["accepted_proposal_cannot_be_deleted", "proposal_has_accepted_history", "proposal_has_protected_history"].find((code) => error.message.includes(code));
    return NextResponse.json({ ok: false, error: protectedHistory || error.message }, { status: protectedHistory ? 409 : 400 });
  }
  return NextResponse.json({ ok: true, data });
}
