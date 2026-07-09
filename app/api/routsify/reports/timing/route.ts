import { NextResponse } from "next/server";
import { buildTimingMetrics } from "@/lib/report-master";

export async function GET() {
  return NextResponse.json({ data: buildTimingMetrics() });
}
