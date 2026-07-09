import { NextResponse } from "next/server";
import { demoSettings, moduleFor, settingsForModule, updateSettingsDemo } from "@/lib/settings-master";

export async function GET(_: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return NextResponse.json({ module: moduleFor(module), data: settingsForModule(module, demoSettings) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body.settings) ? body.settings : [];
  const allowed = updates.filter((item: { module?: string }) => !item.module || item.module === module);
  const result = updateSettingsDemo(demoSettings, allowed);
  return NextResponse.json({ ok: true, module: moduleFor(module), ...result });
}
