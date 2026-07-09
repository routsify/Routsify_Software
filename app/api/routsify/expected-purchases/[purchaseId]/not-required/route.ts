import { NextResponse } from "next/server";
import { getPurchaseDetail, markPurchaseNotRequired } from "@/lib/purchase-master";

export async function POST(request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const detail = getPurchaseDetail(decodeURIComponent(purchaseId));
  if (!detail) return NextResponse.json({ error: "Expected purchase not found" }, { status: 404 });
  if (!body.reason || !body.comment) return NextResponse.json({ error: "Reason and comment are required" }, { status: 400 });
  return NextResponse.json({ ok: true, purchase: markPurchaseNotRequired(detail.purchase, body.reason), event: "expected_purchase.not_required", auditEvent: { action: "not_required", reason: body.reason, comment: body.comment, createdAt: "Ahora" } });
}
