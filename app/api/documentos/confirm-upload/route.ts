import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess, sanitizeFileName } from "@/lib/api-security";
import { confirmDocumentUploadRepository } from "@/lib/server-repositories";

const allowedOwnerTypes = ["case", "traveler", "supplier_invoice"];
const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function validateConfirmUpload(input: Record<string, unknown>) {
  if (!allowedOwnerTypes.includes(String(input.ownerType))) return "invalid_owner_type";
  if (!input.storagePath || typeof input.storagePath !== "string") return "storage_path_required";
  if (!input.fileName || typeof input.fileName !== "string") return "file_name_required";
  if (!input.mimeType || !allowedMimeTypes.includes(String(input.mimeType))) return "unsupported_mime_type";
  if (!input.sizeBytes || Number(input.sizeBytes) <= 0 || Number(input.sizeBytes) > 10 * 1024 * 1024) return "invalid_size";
  if (input.checksum && typeof input.checksum !== "string") return "invalid_checksum";
  return null;
}

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  const validationError = validateConfirmUpload(body);
  if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });

  const result = await confirmDocumentUploadRepository({
    organizationId: access.organizationId,
    caseId: typeof body.caseId === "string" ? body.caseId : null,
    ownerType: body.ownerType as "case" | "traveler" | "supplier_invoice",
    ownerId: typeof body.ownerId === "string" ? body.ownerId : null,
    title: typeof body.title === "string" ? body.title : sanitizeFileName(String(body.fileName)),
    type: typeof body.type === "string" ? body.type : "documento",
    storagePath: String(body.storagePath),
    fileName: sanitizeFileName(String(body.fileName)),
    mimeType: String(body.mimeType),
    sizeBytes: Number(body.sizeBytes),
    checksum: typeof body.checksum === "string" ? body.checksum : null,
    sensitivity: body.sensitivity === "sensitive" || body.sensitivity === "public" ? body.sensitivity : "private",
    retentionDays: typeof body.retentionDays === "number" ? body.retentionDays : 60,
    actorId: access.actorId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
