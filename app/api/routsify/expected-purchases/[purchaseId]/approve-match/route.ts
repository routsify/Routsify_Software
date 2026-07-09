import { NextResponse } from "next/server";
import { approvePurchaseMatch, getPurchaseDetail } from "@/lib/purchase-master";

export async function POST(request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const detail = getPurchaseDetail(decodeURIComponent(purchaseId));
  if (!detail) return NextResponse.json({ error: "Expected purchase not found" }, { status: 404 });
  if (!detail.purchase.holdedPurchaseId && !body.holdedPurchaseId) return NextResponse.json({ error: "Holded document is required" }, { status: 400 });
  return NextResponse.json({ ok: true, purchase: approvePurchaseMatch(detail.purchase), event: "expected_purchase.approved", updated: ["budget_line.real_cost", "budget.real_margin", "case.real_margin", "case.timeline", "audit_log"] });
}
