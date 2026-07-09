import { NextResponse } from "next/server";
import { demoExpectedPurchases, filterPurchases, purchaseKpis } from "@/lib/purchase-master";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "20");
  const filtered = filterPurchases(demoExpectedPurchases, {
    search: url.searchParams.get("search") || "",
    status: url.searchParams.get("status") || "Todos",
    provider: url.searchParams.get("providerId") || url.searchParams.get("provider") || "Todos",
    caseCode: url.searchParams.get("caseId") || url.searchParams.get("caseCode") || "Todos",
    match: url.searchParams.get("matchStatus") || "Todos",
  });
  const start = (page - 1) * limit;
  return NextResponse.json({ data: filtered.slice(start, start + limit), pagination: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) }, kpis: purchaseKpis(filtered) });
}
