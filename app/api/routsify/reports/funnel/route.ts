import { NextResponse } from "next/server";
import { buildFunnel } from "@/lib/report-master";

export async function GET() {
  return NextResponse.json({ data: buildFunnel() });
}
