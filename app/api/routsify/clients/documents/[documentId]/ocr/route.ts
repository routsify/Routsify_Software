import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { runDocumentOcr } from "@/lib/openai-ocr-server";
import { resolveOrganizationId } from "@/lib/request-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { documentId } = await params;
  const body = await request.json().catch(() => ({}));
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    const data = await runDocumentOcr({ organizationId, documentId, travelerId: body?.travelerId ? String(body.travelerId) : null, actorId: access.actorId });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ocr_failed";
    return NextResponse.json({ ok: false, error: message }, { status: message === "document_not_found" ? 404 : 400 });
  }
}
