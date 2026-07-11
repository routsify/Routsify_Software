import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: Promise<{ integration: string }> }) {
  const { integration } = await params;
  return NextResponse.json({ ok: false, integration, error: "integration_test_disabled_until_credentials_are_configured" }, { status: 501 });
}
