import { NextRequest, NextResponse } from "server";

import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  return NextResponse.json({ ok: false, error: "settings_export_disabled_in_production" }, { status: 410 });
}
