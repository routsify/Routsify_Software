import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, error: "legacy_budget_versions_disabled_use_proposals" }, { status: 410 });
}
