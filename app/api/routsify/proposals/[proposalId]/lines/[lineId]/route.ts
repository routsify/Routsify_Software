import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";
import { calculateSalePrice, resolveMarginRule } from "@/lib/economics-server";

function numeric(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

async function lineContext(organizationId: string, proposalId: string, lineId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: line, error } = await supabase
    .from("budget_lines")
    .select("id,proposal_version_id,proposal_versions!inner(id,proposal_id,organization_id,locked,status)")
    .eq("id", lineId)
    .eq("proposal_versions.proposal_id", proposalId)
    .eq("proposal_versions.organization_id", organizationId)
    .maybeSingle();
  if (error || !line) return null;
  const version = Array.isArray(line.proposal_versions) ? line.proposal_versions[0] : line.proposal_versions;
  return { line, version: version as { id: string; locked?: boolean; status?: string } };
}

async function recalculate(versionId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: lines } = await supabase.from("budget_lines").select("cost_budget,sale_price").eq("proposal_version_id", versionId);
  const totalCost = (lines || []).reduce((sum, item) => sum + numeric(item.cost_budget), 0);
  const totalSale = (lines || []).reduce((sum, item) => sum + numeric(item.sale_price), 0);
  await supabase.from("proposal_versions").update({ total_cost: totalCost, total_cost_budget: totalCost, total_sale: totalSale, budgeted_profit: totalSale - totalCost }).eq("id", versionId);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ proposalId: string; lineId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId, lineId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const context = await lineContext(organizationId, proposalId, lineId);
  if (!context) return NextResponse.json({ ok: false, error: "line_not_found" }, { status: 404 });
  if (context.version.locked || context.version.status === "accepted") return NextResponse.json({ ok: false, error: "accepted_version_locked" }, { status: 409 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const source = body as Record<string, unknown>;
  const description = String(source.description_public || "").trim();
  const cost = numeric(source.cost_budget);
  const explicitMargin = source.margin_applied === undefined || source.margin_applied === null || source.margin_applied === "" ? null : Number(source.margin_applied);
  if (description.length < 2) return NextResponse.json({ ok: false, error: "description_required" }, { status: 400 });
  if (cost < 0) return NextResponse.json({ ok: false, error: "invalid_cost" }, { status: 400 });
  if (explicitMargin !== null && (!Number.isFinite(explicitMargin) || explicitMargin < 0 || explicitMargin >= 100)) return NextResponse.json({ ok: false, error: "invalid_margin" }, { status: 400 });
  const supplierId = source.supplier_id ? String(source.supplier_id) : null;
  const serviceTypeCode = source.service_type_code ? String(source.service_type_code) : "custom";
  const rule = await resolveMarginRule({ organizationId, explicitMarginPercent: explicitMargin, supplierId, serviceTypeCode, destination: source.destination_segment ? String(source.destination_segment) : null });
  const sale = source.sale_price === undefined || source.sale_price === null || source.sale_price === "" ? calculateSalePrice(cost, rule.percent, rule.formula) : numeric(source.sale_price);

  const { data, error } = await getSupabaseAdminClient()
    .from("budget_lines")
    .update({
      description_public: description,
      description_internal: String(source.description_internal || "").trim() || null,
      service_type_code: serviceTypeCode,
      supplier_id: supplierId,
      supplier_name: String(source.supplier_name || "").trim() || null,
      destination_segment: String(source.destination_segment || "").trim() || null,
      start_date: source.start_date ? String(source.start_date) : null,
      end_date: source.end_date ? String(source.end_date) : null,
      cost_budget: cost,
      margin_applied: rule.fraction,
      margin_rule_id: rule.ruleId,
      margin_snapshot: rule.snapshot,
      sale_price: sale,
      creates_expected_purchase: source.creates_expected_purchase === undefined ? Boolean(supplierId || String(source.supplier_name || "").trim()) : Boolean(source.creates_expected_purchase),
      updated_at: new Date().toISOString(),
    })
    .eq("id", lineId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "line_not_found" }, { status: 404 });
  await recalculate(context.version.id);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ proposalId: string; lineId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId, lineId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const context = await lineContext(organizationId, proposalId, lineId);
  if (!context) return NextResponse.json({ ok: false, error: "line_not_found" }, { status: 404 });
  if (context.version.locked || context.version.status === "accepted") return NextResponse.json({ ok: false, error: "accepted_version_locked" }, { status: 409 });

  const { error } = await getSupabaseAdminClient().from("budget_lines").delete().eq("id", lineId).eq("organization_id", organizationId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await recalculate(context.version.id);
  return NextResponse.json({ ok: true, data: { id: lineId } });
}
