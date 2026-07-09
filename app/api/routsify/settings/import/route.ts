import { NextResponse } from "next/server";
import { demoSettings, importSettingsPreview } from "@/lib/settings-master";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const payload = typeof body.settings === "object" && body.settings ? body.settings : body;
  return NextResponse.json({ ok: true, mode: "preview", differences: importSettingsPreview(payload, demoSettings), eventName: "settings.imported" });
}
