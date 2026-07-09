import { NextResponse } from "next/server";
import { getBudgetDetail } from "@/lib/budget-master";

export async function POST(request: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const body = await request.json().catch(() => ({}));
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ ok: true, budget: { ...detail.budget, status: "rejected", lastActivityAt: "Ahora" }, event: "budget.rejected", reason: body.reason || "Motivo pendiente", generated: ["reporting_metric", "case_followup_task"] });
}
