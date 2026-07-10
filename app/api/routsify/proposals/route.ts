import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { listProposalsRepository } from "@/lib/server-repositories";

export async function GET(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const result = await listProposalsRepository();
  return NextResponse.json(result);
}
