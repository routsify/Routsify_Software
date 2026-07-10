import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { deleteBudgetLineRepository } from "@/lib/server-repositories";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ proposalId: string; lineId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { lineId } = await params;
  const result = await deleteBudgetLineRepository(lineId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
