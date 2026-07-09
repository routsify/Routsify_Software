import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export const CASE_DOCUMENTS_BUCKET = "case-documents";

export function buildCaseDocumentPath(input: { organizationId: string; caseCode: string; fileName: string }) {
  const safeCase = input.caseCode.replace(/[^a-zA-Z0-9-_]/g, "-");
  const safeFile = input.fileName.replace(/[^a-zA-Z0-9-_.]/g, "-");
  return `${input.organizationId}/${safeCase}/${Date.now()}-${safeFile}`;
}

async function auditDocumentAccess(input: { organizationId: string; path: string; purpose: string; actorId?: string; expiresAt?: string }) {
  if (!hasSupabaseAdminEnv()) return { ok: true, mode: "demo" as const };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("document_access_log").insert({
    organization_id: input.organizationId,
    purpose: input.purpose,
    action: input.purpose,
    actor_id: input.actorId && input.actorId !== "demo" && input.actorId !== "session" && input.actorId !== "internal" ? input.actorId : null,
    expires_at: input.expiresAt || null,
    user_agent: `path:${input.path}`,
  });
  return error ? { ok: false, mode: "real" as const, error: error.message } : { ok: true, mode: "real" as const };
}

export async function createCaseDocumentUploadUrl(input: { organizationId: string; caseCode: string; fileName: string; actorId?: string }) {
  const path = buildCaseDocumentPath(input);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  if (!hasSupabaseAdminEnv()) {
    return { ok: true, mode: "demo" as const, bucket: CASE_DOCUMENTS_BUCKET, path, signedUrl: null, expiresAt };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(CASE_DOCUMENTS_BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, mode: "real" as const, error: error.message, bucket: CASE_DOCUMENTS_BUCKET, path };
  await auditDocumentAccess({ organizationId: input.organizationId, path, purpose: "signed_upload_url_issued", actorId: input.actorId, expiresAt });
  return { ok: true, mode: "real" as const, bucket: CASE_DOCUMENTS_BUCKET, path, signedUrl: data.signedUrl, token: data.token, expiresAt };
}

export async function createCaseDocumentReadUrl(path: string, expiresInSeconds = 300, input?: { organizationId?: string; actorId?: string; purpose?: string }) {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  if (!hasSupabaseAdminEnv()) {
    return { ok: true, mode: "demo" as const, signedUrl: null, path, expiresAt };
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(CASE_DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) return { ok: false, mode: "real" as const, error: error.message, path };
  if (input?.organizationId) await auditDocumentAccess({ organizationId: input.organizationId, path, purpose: input.purpose || "signed_read_url_issued", actorId: input.actorId, expiresAt });
  return { ok: true, mode: "real" as const, signedUrl: data.signedUrl, path, expiresAt };
}
