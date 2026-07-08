export type BudgetLine = {
  id: string;
  service_type_code: string;
  description_public: string;
  description_internal?: string;
  supplier_name?: string;
  destination_segment?: string;
  start_date?: string;
  end_date?: string;
  cost_budget: number;
  margin_applied: number;
  sale_price: number;
  creates_expected_purchase: boolean;
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSalePriceFromMargin(costBudget: number, marginApplied: number) {
  const safeCost = Number.isFinite(costBudget) ? Math.max(costBudget, 0) : 0;
  const safeMargin = Number.isFinite(marginApplied) ? Math.min(Math.max(marginApplied, 0), 0.95) : 0;
  if (safeCost === 0) return 0;
  return roundMoney(safeCost / (1 - safeMargin));
}

export function calculateBudgetTotals(lines: BudgetLine[]) {
  const totalCost = roundMoney(lines.reduce((sum, line) => sum + line.cost_budget, 0));
  const totalSale = roundMoney(lines.reduce((sum, line) => sum + line.sale_price, 0));
  const profit = roundMoney(totalSale - totalCost);
  const margin = totalSale > 0 ? roundMoney(profit / totalSale) : 0;
  const expectedPurchases = lines.filter((line) => line.creates_expected_purchase).length;

  return { totalCost, totalSale, profit, margin, expectedPurchases };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}
