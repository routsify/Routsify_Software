import { NextResponse } from "next/server";
import { getBudgetDetail } from "@/lib/budget-master";

export async function POST(_: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  if (!["sent", "internal_review"].includes(detail.budget.status)) return NextResponse.json({ error: "Budget must be sent or internally reviewed before acceptance" }, { status: 400 });
  return NextResponse.json({ ok: true, budget: { ...detail.budget, status: "accepted", acceptedAt: "Ahora", lastActivityAt: "Ahora" }, event: "budget.accepted", generated: ["expected_purchases", "traveler_request_task", "contract_preflight", "reporting_metric"] });
}
