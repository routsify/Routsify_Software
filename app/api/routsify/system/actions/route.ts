import { NextResponse } from "next/server";
import { runSystemAction } from "@/lib/settings-master";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(runSystemAction(String(body.actionId || "")));
}
