import { NextResponse } from "next/server";
import { demoSettings, moduleFor, resetModuleDemo } from "@/lib/settings-master";

export async function POST(_: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const result = resetModuleDemo(module, demoSettings);
  return NextResponse.json({ ok: true, module: moduleFor(module), ...result, eventName: "settings.reset" });
}
