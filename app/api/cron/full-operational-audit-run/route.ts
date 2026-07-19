import { NextRequest } from "next/server";
import { POST as runAudit } from "../full-operational-audit/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || "";
  const phase = request.nextUrl.searchParams.get("phase") || "all";
  const internalRequest = new NextRequest(request.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ phase }),
  });
  return runAudit(internalRequest);
}
