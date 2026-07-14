import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  return NextResponse.json({ ok: false, error: "legacy_demo_report_disabled", message: "The time-series API is disabled until it is backed by production data." }, { status: 410 });
}
