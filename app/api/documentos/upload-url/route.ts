import { NextRequest, NextResponse } from "next/server";
import { createCaseDocumentUploadUrl } from "@/lib/storage-server";
import { jsonAccessDenied, requireInternalAccess, sanitizeFileName, validatePrivateUpload } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null) as { caseCode?: string; fileName?: string; sizeBytes?: number; mimeType?: string } | null;
  const error = validatePrivateUpload(body || {});
  if (error || !body?.caseCode || !body.fileName) {
    return NextResponse.json({ ok: false, error: error || "caseCode_fileName_required" }, { status: 400 });
  }

  const result = await createCaseDocumentUploadUrl({ organizationId: access.organizationId, caseCode: body.caseCode, fileName: sanitizeFileName(body.fileName) });
  return NextResponse.json({ ...result, audit: { actorId: access.actorId, accessMode: access.mode, purpose: "case_document_upload" } }, { status: result.ok ? 200 : 400 });
}
