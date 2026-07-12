import { NextRequest, NextResponse } from "next/server";
import { createPrivateDocumentUploadUrl, type PrivateDocumentOwner } from "@/lib/storage-server";
import { canAccessSensitiveTravelerData, jsonAccessDenied, requireInternalAccess, sanitizeFileName, validatePrivateUpload } from "@/lib/api-security";

const allowedOwnerTypes = new Set<PrivateDocumentOwner>(["case", "traveler", "supplier_invoice", "proposal_asset"]);

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null) as { caseCode?: string; fileName?: string; sizeBytes?: number; mimeType?: string; ownerType?: PrivateDocumentOwner; ownerId?: string } | null;
  const error = validatePrivateUpload(body || {});
  if (error || !body?.caseCode || !body.fileName) return NextResponse.json({ ok: false, error: error || "caseCode_fileName_required" }, { status: 400 });
  const ownerType = body.ownerType || "case";
  if (ownerType === "traveler" && !canAccessSensitiveTravelerData(access.role)) return NextResponse.json({ ok: false, error: "sensitive_document_access_denied" }, { status: 403 });
  if (!allowedOwnerTypes.has(ownerType)) return NextResponse.json({ ok: false, error: "invalid_owner_type" }, { status: 400 });
  if (ownerType !== "case" && !body.ownerId) return NextResponse.json({ ok: false, error: "owner_id_required" }, { status: 400 });

  const result = await createPrivateDocumentUploadUrl({
    organizationId: access.organizationId,
    caseCode: body.caseCode,
    fileName: sanitizeFileName(body.fileName),
    ownerType,
    ownerId: body.ownerId || null,
    actorId: access.actorId,
  });
  return NextResponse.json({ ...result, audit: { actorId: access.actorId, accessMode: access.mode, purpose: `${ownerType}_upload` } }, { status: result.ok ? 200 : 400 });
}
