import { NextResponse } from "next/server";
import { getBudgetDetail } from "@/lib/budget-master";

export async function GET(_: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const body = await request.json();
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ ok: true, budget: { ...detail.budget, ...body, lastActivityAt: "Ahora" }, auditEvent: { action: "budget.updated", userName: "María García", createdAt: "Ahora" } });
}
