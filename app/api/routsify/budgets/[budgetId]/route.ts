import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: false, error: "legacy_budget_detail_disabled_use_proposals" }, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json({ ok: false, error: "legacy_budget_detail_disabled_use_proposals" }, { status: 410 });
}
