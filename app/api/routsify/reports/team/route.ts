import { NextResponse } from "next/server";
import { buildTeamReport } from "@/lib/report-master";

export async function GET() {
  return NextResponse.json({ data: buildTeamReport() });
}
