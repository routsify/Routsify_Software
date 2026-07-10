import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, error: "settings_import_disabled_in_production" }, { status: 410 });
}
