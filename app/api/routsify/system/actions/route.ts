import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, error: "system_actions_disabled_in_production" }, { status: 410 });
}
