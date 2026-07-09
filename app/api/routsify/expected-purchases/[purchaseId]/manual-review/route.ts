import { NextResponse } from "next/server";
import { getPurchaseDetail } from "@/lib/purchase-master";

export async function POST(request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const detail = getPurchaseDetail(decodeURIComponent(purchaseId));
  if (!detail) return NextResponse.json({ error: "Expected purchase not found" }, { status: 404 });
  if (!body.reason) return NextResponse.json({ error: "Reason is required for manual review" }, { status: 400 });
  return NextResponse.json({ ok: true, decision: body.decision || "request_supplier", event: "expected_purchase.review_needed", task: { title: "Revisar compra proveedor", assignedTo: detail.purchase.responsibleName, status: "open" }, auditEvent: { action: "manual_review", reason: body.reason, createdAt: "Ahora" } });
}
