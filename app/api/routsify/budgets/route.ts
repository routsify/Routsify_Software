import { NextRequest, NextResponse } from "next/server";

import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  return NextResponse.json({ ok: false, error: "legacy_budgets_endpoint_disabled_use_proposals" }, { status: 410 });
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  return NextResponse.json({ ok: false, error: "legacy_budgets_endpoint_disabled_use_proposals" }, { status: 410 });
}
