import { NextResponse } from "next/server";
import { getBudgetDetail } from "@/lib/budget-master";

export async function POST(_: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ ok: true, channel: "holded", event: "budget.holded_synced", idempotencyKey: `${detail.budget.caseCode}:${detail.budget.code}:estimate`, syncStatus: "manual_review" });
}
