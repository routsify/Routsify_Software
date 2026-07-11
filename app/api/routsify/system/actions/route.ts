import { NextRequest, NextResponse } from "next/server";

import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  return NextResponse.json({ ok: false, error: "system_actions_disabled_in_production" }, { status: 410 });
}
