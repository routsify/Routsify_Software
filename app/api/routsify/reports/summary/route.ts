import { NextResponse } from "next/server";
import { reportSummary } from "@/lib/report-master";

export async function GET() {
  return NextResponse.json(reportSummary());
}
