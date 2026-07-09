import { NextResponse } from "next/server";
import { getBudgetDetail } from "@/lib/budget-master";

export async function POST(_: Request, { params }: { params: Promise<{ budgetId: string }> }) {
  const { budgetId } = await params;
  const detail = getBudgetDetail(decodeURIComponent(budgetId));
  if (!detail) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ ok: true, version: { id: `version-${Date.now()}`, versionNumber: detail.budget.currentVersion + 1, status: "draft", createdAt: "Ahora", summary: "Nueva versión demo creada desde snapshot anterior" }, event: "budget.version_created" }, { status: 201 });
}
