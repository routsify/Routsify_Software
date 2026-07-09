import { NextResponse } from "next/server";
import { demoSettings, exportDemoSettings } from "@/lib/settings-master";

export async function GET() {
  return NextResponse.json(exportDemoSettings(demoSettings), { headers: { "content-disposition": "attachment; filename=routsify-settings-demo.json" } });
}
