import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: false, error: "legacy_budgets_endpoint_disabled_use_proposals" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "legacy_budgets_endpoint_disabled_use_proposals" }, { status: 410 });
}
