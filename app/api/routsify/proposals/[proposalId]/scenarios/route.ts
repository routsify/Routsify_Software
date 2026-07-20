import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createProposalScenario, listProposalScenarios } from "@/lib/proposal-scenarios-server";
import { getRequestUserId, resolveOrganizationId } from "@/lib/request-context";

export async function GET(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    return NextResponse.json({ ok: true, data: await listProposalScenarios(organizationId, proposalId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "scenario_list_failed" }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const { proposalId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const source = body as Record<string, unknown>;
  const result = await createProposalScenario({
    organizationId,
    proposalId,
    actorId,
    name: source.name,
    scenarioType: source.scenario_type,
    description: source.description,
    targetMarginPct: source.target_margin_pct,
    sourceVersionId: source.source_version_id,
  });
  return NextResponse.json(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }, { status: result.status });
}
