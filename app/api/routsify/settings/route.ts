import { NextResponse } from "next/server";
import { demoSettings, exportDemoSettings, settingsSummary, updateSettingsDemo } from "@/lib/settings-master";

export async function GET() {
  return NextResponse.json({ data: demoSettings, summary: settingsSummary(demoSettings) });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body.settings) ? body.settings : [];
  const result = updateSettingsDemo(demoSettings, updates);
  return NextResponse.json({ ok: true, ...result, exportPreview: exportDemoSettings(result.settings) });
}
