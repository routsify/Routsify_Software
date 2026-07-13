import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { calculateSalePrice, resolveMarginRule } from "@/lib/economics-server";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function numeric(value: unknown, fallback = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function optionalText(value: unknown) {
  const result = String(value || "").trim();
  return result || null;
}

function validDate(value: string | null) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  const versionId = String(body?.proposal_version_id || "").trim();
  const rows = Array.isArray(body?.rows) ? body.rows as Record<string, unknown>[] : [];
  if (!versionId) return NextResponse.json({ ok: false, error: "proposal_version_required" }, { status: 400 });
  if (!rows.length || rows.length > 200) return NextResponse.json({ ok: false, error: "rows_must_be_between_1_and_200" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const db = getSupabaseAdminClient();
  const { data: version, error: versionError } = await db.from("proposal_versions")
    .select("id,locked,status")
    .eq("id", versionId)
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (versionError || !version) return NextResponse.json({ ok: false, error: versionError?.message || "proposal_version_not_found" }, { status: versionError ? 400 : 404 });
  if (version.locked || version.status === "accepted") return NextResponse.json({ ok: false, error: "proposal_version_locked" }, { status: 409 });

  const { count } = await db.from("budget_lines").select("id", { count: "exact", head: true }).eq("proposal_version_id", versionId);
  const inserts: Record<string, unknown>[] = [];
  const validationErrors: Array<{ row: number; error: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const source = rows[index];
    const description = String(source.description_public || source.description || "").trim();
    const cost = numeric(source.cost_budget ?? source.cost, Number.NaN);
    const marginValue = source.margin_applied ?? source.margin;
    const explicitMargin = marginValue === undefined || marginValue === null || marginValue === "" ? null : numeric(marginValue, Number.NaN);
    const saleValue = source.sale_price ?? source.sale;
    const explicitSale = saleValue === undefined || saleValue === null || saleValue === "" ? null : numeric(saleValue, Number.NaN);
    const serviceTypeCode = String(source.service_type_code || source.type || "custom").trim() || "custom";
    const startDate = optionalText(source.start_date);
    const endDate = optionalText(source.end_date);

    if (description.length < 2) validationErrors.push({ row: index + 1, error: "description_required" });
    if (!Number.isFinite(cost) || cost < 0) validationErrors.push({ row: index + 1, error: "invalid_cost" });
    if (explicitMargin !== null && (!Number.isFinite(explicitMargin) || explicitMargin < 0 || explicitMargin >= 100)) validationErrors.push({ row: index + 1, error: "invalid_margin" });
    if (explicitSale !== null && (!Number.isFinite(explicitSale) || explicitSale < 0)) validationErrors.push({ row: index + 1, error: "invalid_sale_price" });
    if (!validDate(startDate) || !validDate(endDate) || (startDate && endDate && startDate > endDate)) validationErrors.push({ row: index + 1, error: "invalid_dates" });
    if (validationErrors.some((item) => item.row === index + 1)) continue;

    const supplierId = optionalText(source.supplier_id);
    const supplierName = optionalText(source.supplier_name ?? source.supplier);
    const destination = optionalText(source.destination_segment ?? source.destination);
    const rule = await resolveMarginRule({ organizationId, explicitMarginPercent: explicitMargin, supplierId, serviceTypeCode, destination });
    const salePrice = explicitSale ?? calculateSalePrice(cost, rule.percent, rule.formula);
    const purchaseFlag = source.creates_expected_purchase ?? source.purchase;
    const createsExpectedPurchase = purchaseFlag === undefined || purchaseFlag === null || purchaseFlag === ""
      ? Boolean(supplierId || supplierName)
      : [true, 1, "1", "true", "yes", "si", "sí", "x"].includes(typeof purchaseFlag === "string" ? purchaseFlag.trim().toLowerCase() : purchaseFlag as boolean | number);

    inserts.push({
      organization_id: organizationId,
      proposal_version_id: versionId,
      stable_line_id: crypto.randomUUID(),
      service_type_code: serviceTypeCode,
      description_public: description,
      description_internal: optionalText(source.description_internal),
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
      creates_expected_purchase: createsExpectedPurchase,
      sort_order: (count || 0) + index,
    });
  }

  if (validationErrors.length) return NextResponse.json({ ok: false, error: "invalid_rows", details: validationErrors }, { status: 400 });
  const { data, error } = await db.from("budget_lines").insert(inserts).select("*");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const totalCost = inserts.reduce((sum, item) => sum + numeric(item.cost_budget), 0);
  const totalSale = inserts.reduce((sum, item) => sum + numeric(item.sale_price), 0);
  const { data: existingLines } = await db.from("budget_lines").select("cost_budget,sale_price").eq("proposal_version_id", versionId);
  const recalculatedCost = (existingLines || []).reduce((sum, item) => sum + numeric(item.cost_budget), 0);
  const recalculatedSale = (existingLines || []).reduce((sum, item) => sum + numeric(item.sale_price), 0);
  await db.from("proposal_versions").update({ total_cost: recalculatedCost, total_cost_budget: recalculatedCost, total_sale: recalculatedSale, budgeted_profit: recalculatedSale - recalculatedCost, updated_at: new Date().toISOString() }).eq("id", versionId).eq("organization_id", organizationId);

  return NextResponse.json({ ok: true, data: data || [], imported: inserts.length, imported_cost: totalCost, imported_sale: totalSale }, { status: 201 });
}
