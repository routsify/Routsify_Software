import { NextRequest, NextResponse } from "next/server";
import { requireInternalAccess, jsonAccessDenied } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { getExpectedPurchase } from "@/lib/expected-purchases-server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { purchaseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getExpectedPurchase(organizationId, purchaseId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "purchase_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: { local_invoices: data.supplier_invoices || [], holded_candidates: [], requires_holded_sync: !data.holded_purchase_id } });
}
