import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { calculateSalePrice, resolveMarginRule } from "@/lib/economics-server";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function numeric(value: unknown) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : Number.NaN;
}

async function recalculateVersion(organizationId: string, versionId: string) {
  const db = getSupabaseAdminClient();
  const { error } = await db.rpc("recalculate_proposal_version_economics", { target_version: versionId });
  if (error) throw new Error(error.message);
  const { data: version, error: versionError } = await db.from("proposal_versions").select("id").eq("id", versionId).eq("organization_id", organizationId).maybeSingle();
  if (versionError || !version) throw new Error(versionError?.message || "proposal_version_not_found");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const description = String(source.description_public || source.description || "").trim();
  const cost = numeric(source.cost_budget ?? 0);
  const explicitMargin = source.margin_applied === undefined || source.margin_applied === null || source.margin_applied === "" ? null : numeric(source.margin_applied);
  const versionId = String(source.proposal_version_id || "").trim();
  const startDate = source.start_date ? String(source.start_date) : null;
  const endDate = source.end_date ? String(source.end_date) : null;

  if (!versionId) return NextResponse.json({ ok: false, error: "proposal_version_required" }, { status: 400 });
  if (description.length < 2) return NextResponse.json({ ok: false, error: "description_required" }, { status: 400 });
  if (!Number.isFinite(cost) || cost < 0) return NextResponse.json({ ok: false, error: "invalid_cost" }, { status: 400 });
  if (explicitMargin !== null && (!Number.isFinite(explicitMargin) || explicitMargin < 0 || explicitMargin >= 100)) return NextResponse.json({ ok: false, error: "invalid_margin" }, { status: 400 });
  if (startDate && endDate && startDate > endDate) return NextResponse.json({ ok: false, error: "invalid_date_range" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const db = getSupabaseAdminClient();
  const { data: version, error: versionError } = await db
    .from("proposal_versions")
    .select("id,locked,status")
    .eq("id", versionId)
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 400 });
  if (!version) return NextResponse.json({ ok: false, error: "proposal_version_not_found" }, { status: 404 });
  if (version.locked || version.status === "accepted") return NextResponse.json({ ok: false, error: "proposal_version_locked" }, { status: 409 });

  try {
    const serviceTypeCode = source.service_type_code ? String(source.service_type_code) : "custom";
    const supplierId = source.supplier_id ? String(source.supplier_id) : null;
    let supplierName: string | null = null;
    if (supplierId) {
      const { data: supplier, error: supplierError } = await db.from("suppliers").select("id,name,active").eq("id", supplierId).eq("organization_id", organizationId).maybeSingle();
      if (supplierError) throw new Error(supplierError.message);
      if (!supplier) return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404 });
      if (supplier.active === false) return NextResponse.json({ ok: false, error: "supplier_inactive" }, { status: 409 });
      supplierName = supplier.name;
    }
    const destination = source.destination_segment ? String(source.destination_segment).trim() || null : null;
    const rule = await resolveMarginRule({ organizationId, explicitMarginPercent: explicitMargin, supplierId, serviceTypeCode, destination });
    const salePrice = source.sale_price === undefined || source.sale_price === null || source.sale_price === "" ? calculateSalePrice(cost, rule.percent, rule.formula) : numeric(source.sale_price);
    if (!Number.isFinite(salePrice) || salePrice < 0) return NextResponse.json({ ok: false, error: "invalid_sale_price" }, { status: 400 });

    const { count, error: countError } = await db
      .from("budget_lines")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("proposal_version_id", versionId);
    if (countError) throw new Error(countError.message);

    const { data, error } = await db.from("budget_lines").insert({
      organization_id: organizationId,
      proposal_version_id: versionId,
      stable_line_id: crypto.randomUUID(),
      service_type_code: serviceTypeCode,
      description_public: description,
      description_internal: source.description_internal ? String(source.description_internal).trim() || null : null,
      supplier_id: supplierId,
      supplier_name: supplierName,
      destination_segment: destination,
      start_date: startDate,
      end_date: endDate,
      cost_budget: cost,
      margin_applied: rule.fraction,
      margin_rule_id: rule.ruleId,
      margin_snapshot: rule.snapshot,
      sale_price: salePrice,
      creates_expected_purchase: source.creates_expected_purchase === undefined ? Boolean(supplierId) : Boolean(source.creates_expected_purchase),
      sort_order: count || 0,
    }).select("*").single();
    if (error) throw new Error(error.message);

    await recalculateVersion(organizationId, versionId);
    return NextResponse.json({ ok: true, mode: "supabase", data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "budget_line_save_failed" }, { status: 400 });
  }
}
