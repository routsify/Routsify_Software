import { NextRequest, NextResponse } from "next/server";

import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
export async function PATCH(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  return NextResponse.json({ ok: false, error: "legacy_budget_lines_disabled_use_proposals" }, { status: 410 });
}
