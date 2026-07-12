import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { reviewOcrRun } from "@/lib/openai-ocr-server";
import { resolveOrganizationId } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { runId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const fields = body.fields && typeof body.fields === "object" ? body.fields as Record<string, string | null> : {};
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    const data = await reviewOcrRun({ organizationId, runId, actorId: access.actorId, fields, approve: body.approve !== false });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ocr_review_failed";
    return NextResponse.json({ ok: false, error: message }, { status: message === "ocr_run_not_found" ? 404 : 400 });
  }
}
