import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export type PrivateDocumentOwner = "case" | "traveler" | "supplier_invoice" | "proposal_asset";
export const CASE_DOCUMENTS_BUCKET = "case-documents";
export const TRAVEL_DOCUMENTS_BUCKET = "travel-documents";
export const INVOICES_BUCKET = "invoices";
export const PROPOSAL_ASSETS_BUCKET = "proposal-assets";
export const LEGAL_DOCUMENTS_BUCKET = "legal-documents";

export function bucketForOwner(ownerType: PrivateDocumentOwner) {
  if (ownerType === "traveler") return TRAVEL_DOCUMENTS_BUCKET;
  if (ownerType === "supplier_invoice") return INVOICES_BUCKET;
  if (ownerType === "proposal_asset") return PROPOSAL_ASSETS_BUCKET;
  return CASE_DOCUMENTS_BUCKET;
}

export function buildPrivateDocumentPath(input: { organizationId: string; caseCode: string; fileName: string; ownerType?: PrivateDocumentOwner; ownerId?: string | null }) {
  const safeCase = input.caseCode.replace(/[^a-zA-Z0-9-_]/g, "-");
  const safeOwner = (input.ownerId || input.ownerType || "case").replace(/[^a-zA-Z0-9-_]/g, "-");
  const safeFile = input.fileName.replace(/[^a-zA-Z0-9-_.]/g, "-");
  return `${input.organizationId}/${safeCase}/${safeOwner}/${Date.now()}-${safeFile}`;
}

async function auditDocumentAccess(input: { organizationId: string; path: string; purpose: string; actorId?: string; expiresAt?: string }) {
  if (!hasSupabaseAdminEnv()) return { ok: true, mode: "demo" as const };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("document_access_log").insert({
    organization_id: input.organizationId,
    purpose: input.purpose,
    action: input.purpose,
    actor_id: input.actorId && !["demo", "session", "internal"].includes(input.actorId) ? input.actorId : null,
    expires_at: input.expiresAt || null,
    user_agent: `path:${input.path}`,
  });
  return error ? { ok: false, mode: "real" as const, error: error.message } : { ok: true, mode: "real" as const };
}

export async function createPrivateDocumentUploadUrl(input: { organizationId: string; caseCode: string; fileName: string; ownerType?: PrivateDocumentOwner; ownerId?: string | null; actorId?: string }) {
  const ownerType = input.ownerType || "case";
  const bucket = bucketForOwner(ownerType);
  const path = buildPrivateDocumentPath({ ...input, ownerType });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "real" as const, error: "supabase_admin_not_configured", bucket, path };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) return { ok: false, mode: "real" as const, error: error.message, bucket, path };
  await auditDocumentAccess({ organizationId: input.organizationId, path, purpose: `${ownerType}_signed_upload_url_issued`, actorId: input.actorId, expiresAt });
  return { ok: true, mode: "real" as const, bucket, path, signedUrl: data.signedUrl, token: data.token, expiresAt };
}

export async function createPrivateDocumentReadUrl(bucket: string, path: string, expiresInSeconds = 300, input?: { organizationId?: string; actorId?: string; purpose?: string }) {
  const allowedBuckets = new Set([CASE_DOCUMENTS_BUCKET, TRAVEL_DOCUMENTS_BUCKET, INVOICES_BUCKET, PROPOSAL_ASSETS_BUCKET, LEGAL_DOCUMENTS_BUCKET]);
  if (!allowedBuckets.has(bucket)) return { ok: false, mode: "real" as const, error: "invalid_private_bucket", path };
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  if (!hasSupabaseAdminEnv()) return { ok: false, mode: "real" as const, error: "supabase_admin_not_configured", path };
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) return { ok: false, mode: "real" as const, error: error.message, path };
  if (input?.organizationId) await auditDocumentAccess({ organizationId: input.organizationId, path, purpose: input.purpose || "signed_read_url_issued", actorId: input.actorId, expiresAt });
  return { ok: true, mode: "real" as const, signedUrl: data.signedUrl, path, bucket, expiresAt };
}

export async function createCaseDocumentReadUrl(path: string, expiresInSeconds = 300, input?: { organizationId?: string; actorId?: string; purpose?: string }) {
  return createPrivateDocumentReadUrl(CASE_DOCUMENTS_BUCKET, path, expiresInSeconds, input);
}
