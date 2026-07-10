import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { updateProposalStatusRepository } from "@/lib/server-repositories";

const allowedStatuses = new Set(["draft", "internal_review", "sent", "accepted", "rejected"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "");
  if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });

  const result = await updateProposalStatusRepository(proposalId, status);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
