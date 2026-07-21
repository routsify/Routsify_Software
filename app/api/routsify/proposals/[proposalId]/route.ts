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
    .select("id,case_id,status,current_version_id,created_at")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (proposalError) return NextResponse.json({ ok: false, error: proposalError.message }, { status: 400 });
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  if (!["draft", "internal_review"].includes(String(proposal.status))) {
    return NextResponse.json({ ok: false, error: "proposal_has_protected_history", blockers: { status: 1 } }, { status: 409 });
  }

  const { data: versions, error: versionsError } = await db.from("proposal_versions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("proposal_id", proposalId);
  if (versionsError) return NextResponse.json({ ok: false, error: versionsError.message }, { status: 400 });
  const versionIds = (versions || []).map((version) => version.id);

  const [acceptances, communications, outbox] = await Promise.all([
    db.from("proposal_acceptances").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("proposal_id", proposalId),
    db.from("communication_followups").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("proposal_id", proposalId),
    db.from("integration_outbox").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("entity_id", proposalId),
  ]);
  const directError = [acceptances, communications, outbox].find((result) => result.error)?.error;
  if (directError) return NextResponse.json({ ok: false, error: directError.message }, { status: 400 });

  let contractsCount = 0;
  let contractVersionsCount = 0;
  let purchasesCount = 0;
  let paymentLinksCount = 0;
  if (versionIds.length) {
    const [contracts, contractVersions, purchases, paymentLinks] = await Promise.all([
      db.from("contracts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("proposal_version_id", versionIds),
      db.from("contract_versions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("proposal_version_id", versionIds),
      db.from("expected_purchases").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("proposal_version_id", versionIds),
      db.from("payment_links").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("proposal_version_id", versionIds),
    ]);
    const versionError = [contracts, contractVersions, purchases, paymentLinks].find((result) => result.error)?.error;
    if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 400 });
    contractsCount = contracts.count || 0;
    contractVersionsCount = contractVersions.count || 0;
    purchasesCount = purchases.count || 0;
    paymentLinksCount = paymentLinks.count || 0;
  }

  const blockers = {
    acceptances: acceptances.count || 0,
    contracts: contractsCount + contractVersionsCount,
    purchases: purchasesCount,
    payment_links: paymentLinksCount,
    communications: communications.count || 0,
    outbox: outbox.count || 0,
  };
  if (Object.values(blockers).some((value) => value > 0)) {
    return NextResponse.json({ ok: false, error: "proposal_has_protected_history", blockers }, { status: 409 });
  }

  const { error: deleteError } = await db.from("proposals").delete().eq("id", proposalId).eq("organization_id", organizationId);
  if (deleteError) return NextResponse.json({ ok: false, error: deleteError.code === "23503" ? "proposal_has_protected_history" : deleteError.message }, { status: deleteError.code === "23503" ? 409 : 400 });

  await db.from("cases").update({ status: "call_done", next_action: "Preparar nuevo presupuesto", updated_at: new Date().toISOString() })
    .eq("id", proposal.case_id)
    .eq("organization_id", organizationId)
    .eq("status", "budget_draft");
  await db.from("audit_log").insert({ organization_id: organizationId, actor_id: access.actorId, entity_type: "proposal", entity_id: proposalId, action: "proposal.deleted", before_data: proposal });
  return NextResponse.json({ ok: true, data: { id: proposalId } });
}
