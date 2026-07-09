import { NextRequest, NextResponse } from "next/server";
import { demoSettings, exportDemoSettings, settingsSummary } from "@/lib/settings-master";
import { updateSettingsRepository } from "@/lib/server-repositories";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";

export async function GET() {
  return NextResponse.json({ data: demoSettings, summary: settingsSummary(demoSettings) });
}

export async function PATCH(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body.settings) ? body.settings : [];
  const result = await updateSettingsRepository(updates);
  return NextResponse.json({ ok: result.ok, ...result, exportPreview: result.ok && "data" in result && typeof result.data === "object" && result.data && "settings" in result.data ? exportDemoSettings(result.data.settings as typeof demoSettings) : null }, { status: result.ok ? 200 : 400 });
}
