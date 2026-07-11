import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess, sanitizeFileName } from "@/lib/api-security";
import { confirmDocumentUploadRepository } from "@/lib/server-repositories";
import { bucketForOwner } from "@/lib/storage-server";

const allowedOwnerTypes = ["case", "traveler", "supplier_invoice"] as const;
const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function validateConfirmUpload(input: Record<string, unknown>) {
  if (!allowedOwnerTypes.includes(input.ownerType as typeof allowedOwnerTypes[number])) return "invalid_owner_type";
  if (!input.storagePath || typeof input.storagePath !== "string") return "storage_path_required";
  if (!input.fileName || typeof input.fileName !== "string") return "file_name_required";
  if (!input.mimeType || !allowedMimeTypes.includes(String(input.mimeType))) return "unsupported_mime_type";
  if (!input.sizeBytes || Number(input.sizeBytes) <= 0 || Number(input.sizeBytes) > 10 * 1024 * 1024) return "invalid_size";
  if (input.checksum && typeof input.checksum !== "string") return "invalid_checksum";
  if (input.ownerType === "supplier_invoice" && (!input.ownerId || !input.caseId)) return "purchase_and_case_required";
  return null;
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const validationError = validateConfirmUpload(body);
  if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });

  const ownerType = body.ownerType as "case" | "traveler" | "supplier_invoice";
  const expectedBucket = bucketForOwner(ownerType);
  const bucket = typeof body.bucket === "string" ? body.bucket : expectedBucket;
  if (bucket !== expectedBucket) return NextResponse.json({ ok: false, error: "bucket_owner_mismatch" }, { status: 400 });

  const result = await confirmDocumentUploadRepository({
    organizationId: access.organizationId,
    caseId: typeof body.caseId === "string" ? body.caseId : null,
    ownerType,
    ownerId: typeof body.ownerId === "string" ? body.ownerId : null,
    title: typeof body.title === "string" ? body.title : sanitizeFileName(String(body.fileName)),
    type: typeof body.type === "string" ? body.type : ownerType === "supplier_invoice" ? "supplier_invoice" : "documento",
    bucket,
    storagePath: String(body.storagePath),
    fileName: sanitizeFileName(String(body.fileName)),
    mimeType: String(body.mimeType),
    sizeBytes: Number(body.sizeBytes),
    checksum: typeof body.checksum === "string" ? body.checksum : null,
    sensitivity: body.sensitivity === "sensitive" || body.sensitivity === "public" ? body.sensitivity : "private",
    retentionDays: typeof body.retentionDays === "number" ? body.retentionDays : ownerType === "supplier_invoice" ? 365 : 60,
    actorId: access.actorId,
    invoiceNumber: typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() || null : null,
    invoiceDate: typeof body.invoiceDate === "string" ? body.invoiceDate : null,
    invoiceBase: optionalNumber(body.invoiceBase),
    invoiceTax: optionalNumber(body.invoiceTax),
    invoiceTotal: optionalNumber(body.invoiceTotal),
    currency: typeof body.currency === "string" ? body.currency.toUpperCase() : "EUR",
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
