import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type MarginRuleRow = {
  id: string;
  supplier_id?: string | null;
  service_type_code?: string | null;
  destination?: string | null;
  formula?: string | null;
  minimum_margin?: number | string | null;
  priority?: number | null;
};

export type MarginResolutionContext = {
  rules: MarginRuleRow[];
  defaultPercent: number;
  defaultFormula: string;
};

export type MarginRuleInput = {
  organizationId: string;
  explicitMarginPercent?: number | null;
  supplierId?: string | null;
  serviceTypeCode?: string | null;
  destination?: string | null;
};

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function unwrapSetting(value: unknown) {
  if (value && typeof value === "object" && "value" in value) return (value as { value?: unknown }).value;
  return value;
}

export async function loadMarginResolutionContext(organizationId: string): Promise<MarginResolutionContext> {
  const supabase = getSupabaseAdminClient();
  const [rulesResult, settingsResult] = await Promise.all([
    supabase
      .from("margin_rules")
      .select("id,supplier_id,service_type_code,destination,formula,minimum_margin,priority")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("priority", { ascending: true }),
    supabase
      .from("routsify_settings")
      .select("key,value")
      .eq("organization_id", organizationId)
      .in("key", ["margins.minimum", "margins.formula"]),
  ]);

  if (rulesResult.error) throw new Error(rulesResult.error.message);
  if (settingsResult.error) throw new Error(settingsResult.error.message);

  const settings = new Map((settingsResult.data || []).map((row) => [String(row.key), unwrapSetting(row.value)]));
  const defaultPercent = finite(settings.get("margins.minimum"), 12);
  const defaultFormula = String(settings.get("margins.formula") || "margin_on_sale");
  if (defaultPercent < 0 || defaultPercent >= 100) throw new Error("invalid_resolved_margin");

  return {
    rules: (rulesResult.data || []) as MarginRuleRow[],
    defaultPercent,
    defaultFormula,
  };
}

export function resolveMarginRuleFromContext(context: MarginResolutionContext, input: Omit<MarginRuleInput, "organizationId">) {
  const explicit = input.explicitMarginPercent;
  if (explicit !== null && explicit !== undefined) {
    if (!Number.isFinite(explicit) || explicit < 0 || explicit >= 100) throw new Error("invalid_margin");
    return {
      percent: explicit,
      fraction: explicit / 100,
      formula: "margin_on_sale",
      source: "line",
      ruleId: null,
      snapshot: { source: "line", percent: explicit, formula: "margin_on_sale" },
    };
  }

  const destination = (input.destination || "").trim().toLowerCase();
  const scored = context.rules
    .map((rule) => {
      let score = 0;
      if (rule.supplier_id) score += rule.supplier_id === input.supplierId ? 100 : -1000;
      if (rule.service_type_code) score += rule.service_type_code === input.serviceTypeCode ? 50 : -1000;
      if (rule.destination) score += rule.destination.trim().toLowerCase() === destination ? 20 : -1000;
      if (!rule.supplier_id && !rule.service_type_code && !rule.destination) score += 1;
      score -= finite(rule.priority, 100) / 1000;
      return { rule, score };
    })
    .filter((item) => item.score > -900)
    .sort((a, b) => b.score - a.score);

  const selected = scored[0]?.rule || null;
  const percent = selected ? finite(selected.minimum_margin, context.defaultPercent) : context.defaultPercent;
  const formula = selected?.formula || context.defaultFormula;
  const source = selected?.supplier_id ? "supplier" : selected?.service_type_code ? "service_type" : selected?.destination ? "destination" : "global_setting";

  if (percent < 0 || percent >= 100) throw new Error("invalid_resolved_margin");
  return {
    percent,
    fraction: percent / 100,
    formula,
    source,
    ruleId: selected?.id || null,
    snapshot: {
      source,
      rule_id: selected?.id || null,
      percent,
      formula,
      supplier_id: input.supplierId || null,
      service_type_code: input.serviceTypeCode || null,
      destination: input.destination || null,
    },
  };
}

export async function resolveMarginRule(input: MarginRuleInput) {
  const context = await loadMarginResolutionContext(input.organizationId);
  return resolveMarginRuleFromContext(context, input);
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
