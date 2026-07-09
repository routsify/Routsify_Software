import { NextResponse } from "next/server";
import { buildProfitabilityRows } from "@/lib/report-master";

export async function GET() {
  return NextResponse.json({ data: buildProfitabilityRows() });
}
