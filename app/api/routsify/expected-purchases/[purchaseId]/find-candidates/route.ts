import { NextResponse } from "next/server";
import { getPurchaseDetail } from "@/lib/purchase-master";

export async function POST(_: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const detail = getPurchaseDetail(decodeURIComponent(purchaseId));
  if (!detail) return NextResponse.json({ error: "Expected purchase not found" }, { status: 404 });
  return NextResponse.json({ ok: true, event: "expected_purchase.holded_candidate_found", candidates: detail.candidate ? [detail.candidate] : [] });
}
