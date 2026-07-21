import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createPrivateDocumentReadUrl, LEGAL_DOCUMENTS_BUCKET } from "@/lib/storage-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { documentId } = await params;
  const { data: document, error } = await getSupabaseAdminClient()
    .from("legal_documents")
    .select("id,storage_bucket,storage_path")
    .eq("id", documentId)
    .eq("organization_id", access.organizationId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!document) return NextResponse.json({ ok: false, error: "legal_document_not_found" }, { status: 404 });
  if (document.storage_bucket !== LEGAL_DOCUMENTS_BUCKET) return NextResponse.json({ ok: false, error: "invalid_private_bucket" }, { status: 400 });
  const result = await createPrivateDocumentReadUrl(LEGAL_DOCUMENTS_BUCKET, document.storage_path, 300, {
    organizationId: access.organizationId,
    actorId: access.actorId,
    purpose: "legal_document_read",
  });
  if (!result.ok || !result.signedUrl) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  const response = NextResponse.redirect(result.signedUrl, 302);
  response.headers.set("cache-control", "private, no-store, max-age=0");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}
