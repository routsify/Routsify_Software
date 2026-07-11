import { NextRequest, NextResponse } from "next/server";

import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
export async function POST(request: NextRequest, { params }: { params: Promise<{ integration: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { integration } = await params;
  return NextResponse.json({ ok: false, integration, error: "integration_test_disabled_until_credentials_are_configured" }, { status: 501 });
}
