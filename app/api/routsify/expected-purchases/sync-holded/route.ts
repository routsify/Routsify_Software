import { NextResponse } from "next/server";
import { demoExpectedPurchases } from "@/lib/purchase-master";

export async function POST() {
  const candidates = demoExpectedPurchases.filter((item) => !item.holdedPurchaseId).map((item) => ({ expectedPurchaseId: item.id, holdedPurchaseId: `holded-${item.code}`, holdedDocumentNumber: `FAC-${item.code.replace("COMP-", "")}`, confidence: 86 }));
  return NextResponse.json({ ok: true, event: "expected_purchase.holded_candidate_found", imported: candidates.length, candidates, idempotency: "holded_purchase_id" });
}
