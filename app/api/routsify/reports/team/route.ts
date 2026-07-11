import { NextRequest, NextResponse } from "next/server";
import { buildTeamReport } from "@/lib/report-master";

import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  return NextResponse.json({ data: buildTeamReport() });
}
