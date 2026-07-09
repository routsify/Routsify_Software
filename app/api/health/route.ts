import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: process.env.NEXT_PUBLIC_APP_NAME || "Routsify Software",
    status: "up",
    timestamp: new Date().toISOString(),
  });
}
