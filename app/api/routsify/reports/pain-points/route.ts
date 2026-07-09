import { NextResponse } from "next/server";
import { buildPainPoints } from "@/lib/report-master";

export async function GET() {
  return NextResponse.json({ data: buildPainPoints() });
}
