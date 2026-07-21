import { randomUUID } from "node:crypto";
import { sanitizeFileName } from "@/lib/api-security";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { LEGAL_DOCUMENTS_BUCKET } from "@/lib/storage-server";

export const LEGAL_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const LEGAL_DOCUMENT_TYPES = ["travel_contract", "general_terms", "privacy_policy", "precontractual_information", "other"] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

const legalDocumentTypes = new Set<string>(LEGAL_DOCUMENT_TYPES);

export function isLegalDocumentType(value: unknown): value is LegalDocumentType {
  return legalDocumentTypes.has(String(value || "").trim());
}

export function validateLegalPdf(input: { fileName?: unknown; sizeBytes?: unknown; mimeType?: unknown }) {
  const fileName = String(input.fileName || "").trim();
  const sizeBytes = Number(input.sizeBytes || 0);
  const mimeType = String(input.mimeType || "").trim().toLowerCase();
  if (sanitizeFileName(fileName).length < 5 || !fileName.toLowerCase().endsWith(".pdf")) return "legal_document_pdf_required";
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > LEGAL_DOCUMENT_MAX_BYTES) return "invalid_legal_document_size";
  if (mimeType && mimeType !== "application/pdf") return "legal_document_pdf_required";
  return null;
}

export function buildLegalDocumentPath(organizationId: string, documentType: LegalDocumentType, fileName: string) {
  const safeFileName = sanitizeFileName(fileName);
  return `${organizationId}/${documentType}/${Date.now()}-${randomUUID()}-${safeFileName}`;
}

export async function createLegalDocumentUploadUrl(input: { organizationId: string; documentType: LegalDocumentType; fileName: string }) {
  const path = buildLegalDocumentPath(input.organizationId, input.documentType, input.fileName);
  if (!hasSupabaseAdminEnv()) return { ok: false as const, error: "supabase_admin_not_configured", bucket: LEGAL_DOCUMENTS_BUCKET, path };
  const { data, error } = await getSupabaseAdminClient().storage.from(LEGAL_DOCUMENTS_BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false as const, error: error.message, bucket: LEGAL_DOCUMENTS_BUCKET, path };
  return {
    ok: true as const,
    bucket: LEGAL_DOCUMENTS_BUCKET,
    path,
    signedUrl: data.signedUrl,
    token: data.token,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

export async function verifyLegalDocumentUpload(input: { organizationId: string; path: string; sizeBytes: number }) {
  const expectedPrefix = `${input.organizationId}/`;
  if (!input.path.startsWith(expectedPrefix) || input.path.includes("..")) return { ok: false as const, error: "invalid_legal_document_path" };
  const separator = input.path.lastIndexOf("/");
  if (separator <= expectedPrefix.length || separator === input.path.length - 1) return { ok: false as const, error: "invalid_legal_document_path" };
  const directory = input.path.slice(0, separator);
  const fileName = input.path.slice(separator + 1);
  const { data, error } = await getSupabaseAdminClient().storage.from(LEGAL_DOCUMENTS_BUCKET).list(directory, { limit: 100, search: fileName });
  if (error) return { ok: false as const, error: error.message };
  const uploaded = (data || []).find((item) => item.name === fileName);
  if (!uploaded) return { ok: false as const, error: "legal_document_upload_not_found" };
  const metadata = uploaded.metadata && typeof uploaded.metadata === "object" ? uploaded.metadata as Record<string, unknown> : {};
  const storedSize = Number(metadata.size || 0);
  const storedMimeType = String(metadata.mimetype || metadata.contentType || "").toLowerCase();
  if (storedSize > 0 && storedSize !== input.sizeBytes) return { ok: false as const, error: "legal_document_size_mismatch" };
  if (storedMimeType && storedMimeType !== "application/pdf") return { ok: false as const, error: "legal_document_pdf_required" };
  return { ok: true as const };
}
