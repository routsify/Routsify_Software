import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: false, error: "settings_export_disabled_in_production" }, { status: 410 });
}
