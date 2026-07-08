import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export const CASE_DOCUMENTS_BUCKET = "case-documents";

export function buildCaseDocumentPath(input: { organizationId: string; caseCode: string; fileName: string }) {
  const safeCase = input.caseCode.replace(/[^a-zA-Z0-9-_]/g, "-");
  const safeFile = input.fileName.replace(/[^a-zA-Z0-9-_.]/g, "-");
  return `${input.organizationId}/${safeCase}/${Date.now()}-${safeFile}`;
}

export async function createCaseDocumentUploadUrl(input: { organizationId: string; caseCode: string; fileName: string }) {
  const path = buildCaseDocumentPath(input);
  if (!hasSupabaseAdminEnv()) {
    return { ok: true, mode: "demo" as const, bucket: CASE_DOCUMENTS_BUCKET, path, signedUrl: null };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(CASE_DOCUMENTS_BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, mode: "real" as const, error: error.message, bucket: CASE_DOCUMENTS_BUCKET, path };
  return { ok: true, mode: "real" as const, bucket: CASE_DOCUMENTS_BUCKET, path, signedUrl: data.signedUrl, token: data.token };
}

export async function createCaseDocumentReadUrl(path: string, expiresInSeconds = 300) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: true, mode: "demo" as const, signedUrl: null, path };
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(CASE_DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) return { ok: false, mode: "real" as const, error: error.message, path };
  return { ok: true, mode: "real" as const, signedUrl: data.signedUrl, path };
}
