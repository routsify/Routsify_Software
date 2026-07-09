import { NextResponse } from "next/server";
import { calculateSalePrice, getBudgetDetail } from "@/lib/budget-master";

export async function POST(_: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  const totalCost = detail.lines.reduce((sum, line) => sum + line.costBudget, 0);
  const totalSale = detail.lines.reduce((sum, line) => sum + calculateSalePrice(line.costBudget, line.marginPct), 0);
  return NextResponse.json({ ok: true, event: "budget.recalculated", financialSummary: { totalCost, totalSale, expectedProfit: totalSale - totalCost, marginPct: totalSale > 0 ? ((totalSale - totalCost) / totalSale) * 100 : 0 } });
}
