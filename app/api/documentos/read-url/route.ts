import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createPrivateDocumentReadUrl } from "@/lib/storage-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  const documentId = String(body?.documentId || "").trim();
  if (!documentId) return NextResponse.json({ ok: false, error: "document_required" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data: document, error } = await getSupabaseAdminClient().from("documents").select("id,storage_path,bucket").eq("id", documentId).eq("organization_id", organizationId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!document) return NextResponse.json({ ok: false, error: "document_not_found" }, { status: 404 });
  const result = await createPrivateDocumentReadUrl(document.bucket || "case-documents", document.storage_path, 300, { organizationId, actorId: access.actorId, purpose: "private_document_read" });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
