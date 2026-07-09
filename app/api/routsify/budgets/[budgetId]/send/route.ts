import { NextResponse } from "next/server";
import { getBudgetDetail } from "@/lib/budget-master";

export async function POST(_: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  if (detail.budget.totalSalePrice <= 0) return NextResponse.json({ error: "Total sale must be greater than zero" }, { status: 400 });
  return NextResponse.json({ ok: true, budget: { ...detail.budget, status: "sent", sentAt: "Ahora", lastActivityAt: "Ahora" }, event: "budget.sent", task: "Hacer seguimiento cliente", holdedEvent: "estimate.sync_pending" });
}
