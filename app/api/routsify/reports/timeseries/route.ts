import { NextResponse } from "next/server";
import { buildTimeSeries } from "@/lib/report-master";

export async function GET() {
  return NextResponse.json({ data: buildTimeSeries() });
}
