import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { calculateSalePrice, loadMarginResolutionContext, resolveMarginRuleFromContext } from "@/lib/economics-server";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function numeric(value: unknown, fallback = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}
function optionalText(value: unknown) { const result = String(value || "").trim(); return result || null; }
function validDate(value: string | null) { return !value || /^\d{4}-\d{2}-\d{2}$/.test(value); }
function normalizeSupplierName(value: unknown) { return String(value || "").trim().toLocaleLowerCase("es-ES").replace(/\s+/g, " "); }

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

  let marginContext;
  try { marginContext = await loadMarginResolutionContext(organizationId); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "margin_context_load_failed" }, { status: 400 }); }

  const { data: existingSuppliers, error: suppliersError } = await db.from("suppliers").select("id,name,active").eq("organization_id", organizationId).limit(1000);
  if (suppliersError) return NextResponse.json({ ok: false, error: suppliersError.message }, { status: 400 });
  const suppliersById = new Map((existingSuppliers || []).map((supplier) => [String(supplier.id), supplier]));
  const suppliersByName = new Map((existingSuppliers || []).map((supplier) => [normalizeSupplierName(supplier.name), supplier]));

  const { data: existingLines, error: existingLinesError } = await db
    .from("budget_lines")
    .select("cost_budget,sale_price,sort_order")
    .eq("organization_id", organizationId)
    .eq("proposal_version_id", versionId);
  if (existingLinesError) return NextResponse.json({ ok: false, error: existingLinesError.message }, { status: 400 });

  const currentLines = existingLines || [];
  const nextSortOrder = currentLines.reduce((max, line) => Math.max(max, Number(line.sort_order || 0) + 1), 0);
  const existingCost = currentLines.reduce((sum, item) => sum + numeric(item.cost_budget), 0);
  const existingSale = currentLines.reduce((sum, item) => sum + numeric(item.sale_price), 0);
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

    const requestedSupplierId = optionalText(source.supplier_id);
    const requestedSupplierName = optionalText(source.supplier_name ?? source.supplier);
    const supplier = requestedSupplierId ? suppliersById.get(requestedSupplierId) : requestedSupplierName ? suppliersByName.get(normalizeSupplierName(requestedSupplierName)) : null;
    if ((requestedSupplierId || requestedSupplierName) && !supplier) validationErrors.push({ row: index + 1, error: "supplier_not_found" });
    if (supplier?.active === false) validationErrors.push({ row: index + 1, error: "supplier_inactive" });
    if (validationErrors.some((item) => item.row === index + 1)) continue;

    const supplierId = supplier ? String(supplier.id) : null;
    const supplierName = supplier ? String(supplier.name) : null;
    const destination = optionalText(source.destination_segment ?? source.destination);
    const rule = resolveMarginRuleFromContext(marginContext, { explicitMarginPercent: explicitMargin, supplierId, serviceTypeCode, destination });
    const salePrice = explicitSale ?? calculateSalePrice(cost, rule.percent, rule.formula);
    const purchaseFlag = source.creates_expected_purchase ?? source.purchase;
    const createsExpectedPurchase = purchaseFlag === undefined || purchaseFlag === null || purchaseFlag === ""
      ? Boolean(supplierId)
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
      margin_snapshot: { ...rule.snapshot, sale_source: explicitSale === null ? "calculated" : "manual" },
      origin_margin: rule.source,
      sale_price: salePrice,
      creates_expected_purchase: createsExpectedPurchase,
      sort_order: nextSortOrder + index,
    });
  }

  if (validationErrors.length) return NextResponse.json({ ok: false, error: "invalid_rows", details: validationErrors }, { status: 400 });

  const { data, error } = await db.from("budget_lines").insert(inserts).select("*");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const importedCost = inserts.reduce((sum, item) => sum + numeric(item.cost_budget), 0);
  const importedSale = inserts.reduce((sum, item) => sum + numeric(item.sale_price), 0);
  const recalculatedCost = existingCost + importedCost;
  const recalculatedSale = existingSale + importedSale;
  const { error: totalsError } = await db.from("proposal_versions")
    .update({ total_cost: recalculatedCost, total_cost_budget: recalculatedCost, total_cost_real: recalculatedCost, total_sale: recalculatedSale, budgeted_profit: recalculatedSale - recalculatedCost, real_profit: recalculatedSale - recalculatedCost, real_margin_pct: recalculatedSale ? (recalculatedSale - recalculatedCost) / recalculatedSale : 0, updated_at: new Date().toISOString() })
    .eq("id", versionId)
    .eq("organization_id", organizationId);
  if (totalsError) return NextResponse.json({ ok: false, error: totalsError.message, imported: inserts.length, lines_saved: true }, { status: 500 });

  return NextResponse.json({ ok: true, data: data || [], imported: inserts.length, imported_cost: importedCost, imported_sale: importedSale, suppliers_created: 0 }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  const versionId = String(body?.proposal_version_id || "").trim();
  const margin = numeric(body?.margin_percentage, Number.NaN);
  if (!versionId) return NextResponse.json({ ok: false, error: "proposal_version_required" }, { status: 400 });
  if (!Number.isFinite(margin) || margin < 0 || margin >= 100) return NextResponse.json({ ok: false, error: "invalid_margin" }, { status: 400 });

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

  const { data: lines, error: linesError } = await db.from("budget_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("proposal_version_id", versionId)
    .order("sort_order", { ascending: true })
    .limit(500);
  if (linesError) return NextResponse.json({ ok: false, error: linesError.message }, { status: 400 });
  if (!lines?.length) return NextResponse.json({ ok: true, data: [], updated: 0 });

  const now = new Date().toISOString();
  const results = await Promise.all(lines.map((line) => {
    const cost = numeric(line.cost_budget);
    const salePrice = calculateSalePrice(cost, margin, "margin_on_sale");
    return db.from("budget_lines").update({
      margin_applied: margin / 100,
      margin_rule_id: null,
      margin_snapshot: { source: "budget_global", percent: margin, formula: "margin_on_sale", applied_at: now },
      origin_margin: "budget_global",
      sale_price: salePrice,
      updated_at: now,
    }).eq("id", line.id).eq("organization_id", organizationId).select("*").single();
  }));
  const updateError = results.find((result) => result.error)?.error;
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
  const updatedLines = results.map((result) => result.data).filter(Boolean);

  const totalCost = updatedLines.reduce((sum, line) => sum + numeric(line?.cost_budget), 0);
  const totalRealCost = updatedLines.reduce((sum, line) => sum + (line?.cost_real === null || line?.cost_real === undefined ? numeric(line?.cost_budget) : numeric(line.cost_real)), 0);
  const totalSale = updatedLines.reduce((sum, line) => sum + numeric(line?.sale_price), 0);
  const budgetedProfit = totalSale - totalCost;
  const realProfit = totalSale - totalRealCost;
  const { error: totalsError } = await db.from("proposal_versions").update({
    total_cost: totalCost,
    total_cost_budget: totalCost,
    total_cost_real: totalRealCost,
    total_sale: totalSale,
    budgeted_profit: budgetedProfit,
    real_profit: realProfit,
    real_margin_pct: totalSale ? realProfit / totalSale : 0,
    cost_deviation: totalRealCost - totalCost,
    updated_at: now,
  }).eq("id", versionId).eq("organization_id", organizationId);
  if (totalsError) return NextResponse.json({ ok: false, error: totalsError.message, lines_updated: true }, { status: 500 });

  return NextResponse.json({ ok: true, data: updatedLines, updated: updatedLines.length, margin_percentage: margin });
}
