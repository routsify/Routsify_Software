import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess, sanitizeFileName } from "@/lib/api-security";
import { createLegalDocumentUploadUrl, isLegalDocumentType, validateLegalPdf } from "@/lib/legal-documents-server";

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const validationError = validateLegalPdf(body);
  if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  if (!isLegalDocumentType(body.documentType)) return NextResponse.json({ ok: false, error: "invalid_legal_document_type" }, { status: 400 });
  const result = await createLegalDocumentUploadUrl({
    organizationId: access.organizationId,
    documentType: body.documentType,
    fileName: sanitizeFileName(String(body.fileName)),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { "cache-control": "private, no-store" } });
}
