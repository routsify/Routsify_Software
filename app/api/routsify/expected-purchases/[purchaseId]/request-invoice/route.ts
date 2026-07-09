import { NextResponse } from "next/server";
import { getPurchaseDetail, requestPurchaseInvoice } from "@/lib/purchase-master";

export async function POST(_: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const detail = getPurchaseDetail(decodeURIComponent(purchaseId));
  if (!detail) return NextResponse.json({ error: "Expected purchase not found" }, { status: 404 });
  return NextResponse.json({ ok: true, purchase: requestPurchaseInvoice(detail.purchase), event: "expected_purchase.requested", task: { title: "Solicitar factura al proveedor", assignedTo: detail.purchase.responsibleName, status: "open" } });
}
