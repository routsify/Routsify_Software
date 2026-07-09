import { NextResponse } from "next/server";
import { testIntegration } from "@/lib/settings-master";

export async function POST(_: Request, { params }: { params: Promise<{ integration: string }> }) {
  const { integration } = await params;
  return NextResponse.json(testIntegration(integration));
}
