import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { addBudgetLineRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const description = String(source.description_public || source.description || "").trim();
  const cost = Number(source.cost_budget || 0);
  const margin = Number(source.margin_applied || 0);
  const versionId = source.proposal_version_id ? String(source.proposal_version_id) : "";
  if (description.length < 2) return NextResponse.json({ ok: false, error: "description_required" }, { status: 400 });
  if (!Number.isFinite(cost) || cost < 0) return NextResponse.json({ ok: false, error: "invalid_cost" }, { status: 400 });
  if (!Number.isFinite(margin) || margin < 0 || margin >= 100) return NextResponse.json({ ok: false, error: "invalid_margin" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  if (versionId) {
    const { data: version } = await getSupabaseAdminClient()
      .from("proposal_versions")
      .select("id,locked,status")
      .eq("id", versionId)
      .eq("proposal_id", proposalId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!version) return NextResponse.json({ ok: false, error: "proposal_version_not_found" }, { status: 404 });
    if (version.locked || version.status === "accepted") return NextResponse.json({ ok: false, error: "proposal_version_locked" }, { status: 409 });
  }

  const result = await addBudgetLineRepository({
    organization_id: organizationId,
    proposal_id: proposalId,
    proposal_version_id: versionId || undefined,
    service_type_code: source.service_type_code ? String(source.service_type_code) : "custom",
    description_public: description,
    supplier_name: source.supplier_name ? String(source.supplier_name).trim() : null,
    cost_budget: cost,
    margin_applied: margin,
    sale_price: source.sale_price === undefined ? undefined : Number(source.sale_price || 0),
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
