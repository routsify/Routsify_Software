import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { addBudgetLineRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { calculateSalePrice, resolveMarginRule } from "@/lib/economics-server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const description = String(source.description_public || source.description || "").trim();
  const cost = Number(source.cost_budget || 0);
  const explicitMargin = source.margin_applied === undefined || source.margin_applied === null || source.margin_applied === "" ? null : Number(source.margin_applied);
  const versionId = source.proposal_version_id ? String(source.proposal_version_id) : "";
  if (description.length < 2) return NextResponse.json({ ok: false, error: "description_required" }, { status: 400 });
  if (!Number.isFinite(cost) || cost < 0) return NextResponse.json({ ok: false, error: "invalid_cost" }, { status: 400 });
  if (explicitMargin !== null && (!Number.isFinite(explicitMargin) || explicitMargin < 0 || explicitMargin >= 100)) return NextResponse.json({ ok: false, error: "invalid_margin" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  if (versionId) {
    const { data: version } = await getSupabaseAdminClient().from("proposal_versions").select("id,locked,status").eq("id", versionId).eq("proposal_id", proposalId).eq("organization_id", organizationId).maybeSingle();
    if (!version) return NextResponse.json({ ok: false, error: "proposal_version_not_found" }, { status: 404 });
    if (version.locked || version.status === "accepted") return NextResponse.json({ ok: false, error: "proposal_version_locked" }, { status: 409 });
  }

  try {
    const serviceTypeCode = source.service_type_code ? String(source.service_type_code) : "custom";
    const supplierId = source.supplier_id ? String(source.supplier_id) : null;
    const rule = await resolveMarginRule({ organizationId, explicitMarginPercent: explicitMargin, supplierId, serviceTypeCode, destination: source.destination_segment ? String(source.destination_segment) : null });
    const salePrice = source.sale_price === undefined || source.sale_price === null || source.sale_price === "" ? calculateSalePrice(cost, rule.percent, rule.formula) : Number(source.sale_price);
    if (!Number.isFinite(salePrice) || salePrice < 0) return NextResponse.json({ ok: false, error: "invalid_sale_price" }, { status: 400 });
    const result = await addBudgetLineRepository({
      organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId || undefined,
      service_type_code: serviceTypeCode, description_public: description,
      description_internal: source.description_internal ? String(source.description_internal) : null,
      supplier_id: supplierId, supplier_name: source.supplier_name ? String(source.supplier_name).trim() : null,
      destination_segment: source.destination_segment ? String(source.destination_segment) : null,
      start_date: source.start_date ? String(source.start_date) : null, end_date: source.end_date ? String(source.end_date) : null,
      cost_budget: cost, margin_applied: rule.percent, margin_rule_id: rule.ruleId, margin_snapshot: rule.snapshot,
      sale_price: salePrice, creates_expected_purchase: source.creates_expected_purchase === undefined ? Boolean(supplierId || String(source.supplier_name || "").trim()) : Boolean(source.creates_expected_purchase),
    });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "margin_resolution_failed" }, { status: 400 });
  }
}
