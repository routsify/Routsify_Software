import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { addBudgetLineRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const description = String(body.description_public || body.description || "").trim();
  if (description.length < 2) return NextResponse.json({ ok: false, error: "description_required" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await addBudgetLineRepository({
    organization_id: organizationId,
    proposal_id: proposalId,
    proposal_version_id: body.proposal_version_id || null,
    service_type_code: body.service_type_code || "custom",
    description_public: description,
    supplier_name: body.supplier_name || null,
    cost_budget: Number(body.cost_budget || 0),
    margin_applied: Number(body.margin_applied || 0),
    sale_price: body.sale_price === undefined ? undefined : Number(body.sale_price || 0),
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
