import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createAiItineraryUploadUrl } from "@/lib/ai-itinerary-import-server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  try {
    const result = await createAiItineraryUploadUrl({
      organizationId: access.organizationId,
      proposalId,
      versionId: String(body.proposal_version_id || "").trim(),
      fileName: String(body.file_name || "").trim(),
      sizeBytes: Number(body.size_bytes || 0),
      mimeType: String(body.mime_type || "application/pdf"),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ai_import_upload_failed";
    const status = message.includes("not_found") ? 404 : message.includes("locked") || message.includes("not_selected") ? 409 : 400;
    return NextResponse.json({ ok: false, error: message }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
