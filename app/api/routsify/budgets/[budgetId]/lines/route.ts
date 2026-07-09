import { NextResponse } from "next/server";
import { getBudgetDetail } from "@/lib/budget-master";

export async function PATCH(request: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const body = await request.json();
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ ok: true, lines: body.lines || detail.lines, event: "budget.lines_updated", task: "Revisar margen y compras esperadas" });
}
