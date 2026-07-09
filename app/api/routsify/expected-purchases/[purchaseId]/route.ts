import { NextResponse } from "next/server";
import { getPurchaseDetail } from "@/lib/purchase-master";

export async function GET(_: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const detail = getPurchaseDetail(decodeURIComponent(purchaseId));
  if (!detail) return NextResponse.json({ error: "Expected purchase not found" }, { status: 404 });
  return NextResponse.json(detail);
}
