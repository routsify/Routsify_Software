import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json({ ok: false, error: "legacy_budget_lines_disabled_use_proposals" }, { status: 410 });
}
