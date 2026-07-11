import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type MarginRuleRow = {
  id: string;
  supplier_id?: string | null;
  service_type_code?: string | null;
  destination?: string | null;
  formula?: string | null;
  minimum_margin?: number | string | null;
  priority?: number | null;
};

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function resolveMarginRule(input: { organizationId: string; explicitMarginPercent?: number | null; supplierId?: string | null; serviceTypeCode?: string | null; destination?: string | null }) {
  const explicit = input.explicitMarginPercent;
  if (explicit !== null && explicit !== undefined) {
    if (!Number.isFinite(explicit) || explicit < 0 || explicit >= 100) throw new Error("invalid_margin");
    return { percent: explicit, fraction: explicit / 100, formula: "margin_on_sale", source: "line", ruleId: null, snapshot: { source: "line", percent: explicit, formula: "margin_on_sale" } };
  }

  const supabase = getSupabaseAdminClient();
  const { data: rules, error } = await supabase.from("margin_rules").select("id,supplier_id,service_type_code,destination,formula,minimum_margin,priority").eq("organization_id", input.organizationId).eq("active", true).order("priority", { ascending: true });
  if (error) throw new Error(error.message);

  const destination = (input.destination || "").trim().toLowerCase();
  const candidates = (rules || []) as MarginRuleRow[];
  const scored = candidates.map((rule) => {
    let score = 0;
    if (rule.supplier_id) score += rule.supplier_id === input.supplierId ? 100 : -1000;
    if (rule.service_type_code) score += rule.service_type_code === input.serviceTypeCode ? 50 : -1000;
    if (rule.destination) score += rule.destination.trim().toLowerCase() === destination ? 20 : -1000;
    if (!rule.supplier_id && !rule.service_type_code && !rule.destination) score += 1;
    score -= finite(rule.priority, 100) / 1000;
    return { rule, score };
  }).filter((item) => item.score > -900).sort((a, b) => b.score - a.score);

  let selected = scored[0]?.rule || null;
  let percent = selected ? finite(selected.minimum_margin, 12) : 12;
  let formula = selected?.formula || "margin_on_sale";
  let source = selected?.supplier_id ? "supplier" : selected?.service_type_code ? "service_type" : selected?.destination ? "destination" : "global";

  if (!selected) {
    const { data: setting } = await supabase.from("routsify_settings").select("value").eq("organization_id", input.organizationId).eq("key", "margins.minimum").maybeSingle();
    const raw = setting?.value;
    percent = finite(typeof raw === "number" ? raw : (raw as { value?: unknown } | null)?.value, 12);
    const { data: formulaSetting } = await supabase.from("routsify_settings").select("value").eq("organization_id", input.organizationId).eq("key", "margins.formula").maybeSingle();
    const formulaRaw = formulaSetting?.value;
    formula = typeof formulaRaw === "string" ? formulaRaw : String((formulaRaw as { value?: unknown } | null)?.value || "margin_on_sale");
    source = "global_setting";
  }
  if (percent < 0 || percent >= 100) throw new Error("invalid_resolved_margin");
  return { percent, fraction: percent / 100, formula, source, ruleId: selected?.id || null, snapshot: { source, rule_id: selected?.id || null, percent, formula, supplier_id: input.supplierId || null, service_type_code: input.serviceTypeCode || null, destination: input.destination || null } };
}

export function calculateSalePrice(cost: number, marginPercent: number, formula = "margin_on_sale") {
  if (cost <= 0) return 0;
  if (formula === "markup_on_cost") return cost * (1 + marginPercent / 100);
  return cost / (1 - marginPercent / 100);
}

export function economicMetrics(input: { costBudget: number; costReal?: number | null; salePrice: number }) {
  const budgetedProfit = input.salePrice - input.costBudget;
  const realCost = input.costReal ?? input.costBudget;
  const realProfit = input.salePrice - realCost;
  return {
    budgetedProfit,
    realProfit,
    budgetedMarginPct: input.salePrice ? budgetedProfit / input.salePrice : 0,
    realMarginPct: input.salePrice ? realProfit / input.salePrice : 0,
    costDeviation: realCost - input.costBudget,
    profitDeviation: realProfit - budgetedProfit,
  };
}
