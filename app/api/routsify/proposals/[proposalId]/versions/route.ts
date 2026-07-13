import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

export async function GET(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient()
    .from("proposal_versions")
    .select("*, budget_lines(*)")
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id,case_id,status")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (proposalError) return NextResponse.json({ ok: false, error: proposalError.message }, { status: 400 });
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });

  const { data: latest, error: latestError } = await supabase
    .from("proposal_versions")
    .select("*")
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) return NextResponse.json({ ok: false, error: latestError.message }, { status: 400 });
  if (!latest) return NextResponse.json({ ok: false, error: "proposal_version_not_found" }, { status: 404 });
  if (!latest.locked && ["draft", "internal_review"].includes(String(latest.status))) {
    return NextResponse.json({ ok: false, error: "editable_version_exists" }, { status: 409 });
  }

  const nextNumber = Number(latest.version_number || 0) + 1;
  const { data: created, error: createError } = await supabase
    .from("proposal_versions")
    .insert({
      organization_id: organizationId,
      proposal_id: proposalId,
      version_number: nextNumber,
      status: "draft",
      title: `Versión ${nextNumber}`,
      narrative: latest.narrative || {},
      terms_snapshot: latest.terms_snapshot || null,
      margin_snapshot: latest.margin_snapshot || {},
      snapshot: latest.snapshot || {},
      total_sale: latest.total_sale || 0,
      total_cost: latest.total_cost || latest.total_cost_budget || 0,
      total_cost_budget: latest.total_cost_budget || latest.total_cost || 0,
      budgeted_profit: latest.budgeted_profit || 0,
      locked: false,
      locked_at: null,
      accepted_at: null,
      expires_at: null,
    })
    .select("*")
    .single();
  if (createError) return NextResponse.json({ ok: false, error: createError.message }, { status: 400 });

  const { data: sourceLines, error: linesError } = await supabase.from("budget_lines").select("*").eq("proposal_version_id", latest.id).order("sort_order", { ascending: true });
  if (linesError) {
    await supabase.from("proposal_versions").delete().eq("id", created.id);
    return NextResponse.json({ ok: false, error: linesError.message }, { status: 400 });
  }

  if (sourceLines?.length) {
    const clones = sourceLines.map((line) => ({
      organization_id: organizationId,
      proposal_version_id: created.id,
      stable_line_id: line.stable_line_id,
      service_type_id: line.service_type_id,
      service_type_code: line.service_type_code,
      description_internal: line.description_internal,
      description_public: line.description_public,
      supplier_id: line.supplier_id,
      supplier_name: line.supplier_name,
      destination_segment: line.destination_segment,
      start_date: line.start_date,
      end_date: line.end_date,
      cost_budget: line.cost_budget,
      cost_real: null,
      margin_applied: line.margin_applied,
      margin_rule_id: line.margin_rule_id,
      margin_snapshot: line.margin_snapshot || {},
      origin_margin: line.origin_margin,
      formula_version_id: line.formula_version_id,
      sale_price: line.sale_price,
      creates_expected_purchase: line.creates_expected_purchase,
      included: line.included !== false,
      sort_order: line.sort_order,
    }));
    const { error: cloneError } = await supabase.from("budget_lines").insert(clones);
    if (cloneError) {
      await supabase.from("proposal_versions").delete().eq("id", created.id);
      return NextResponse.json({ ok: false, error: cloneError.message }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  await supabase.from("proposals").update({ current_version_id: created.id, status: "draft", public_token_hash: null, public_token_expires_at: null, updated_at: now }).eq("id", proposalId).eq("organization_id", organizationId);
  await supabase.from("cases").update({ status: "budget_draft", next_action: "Revisar nueva versión del presupuesto", updated_at: now }).eq("id", proposal.case_id).eq("organization_id", organizationId);
  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: proposal.case_id, event_type: "proposal.version_created", title: `Creada versión ${nextNumber} del presupuesto`, payload: { proposal_id: proposalId, version_id: created.id, previous_version_id: latest.id }, created_by: actorId });

  const { data: full, error: fullError } = await supabase.from("proposal_versions").select("*, budget_lines(*)").eq("id", created.id).single();
  if (fullError) return NextResponse.json({ ok: false, error: fullError.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: full }, { status: 201 });
}
