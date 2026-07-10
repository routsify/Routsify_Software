import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createProposalRepository, listProposalsRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const result = await listProposalsRepository();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const caseId = String(body.case_id || "").trim();
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await createProposalRepository({ organization_id: organizationId, case_id: caseId, status: "draft" });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
