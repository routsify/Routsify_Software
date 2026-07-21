import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess, sanitizeFileName } from "@/lib/api-security";
import { isLegalDocumentType, validateLegalPdf, verifyLegalDocumentUpload } from "@/lib/legal-documents-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { LEGAL_DOCUMENTS_BUCKET } from "@/lib/storage-server";

const NO_STORE_HEADERS = { "cache-control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  let query = getSupabaseAdminClient()
    .from("legal_documents")
    .select("id,document_type,title,version_label,file_name,status,is_active,is_test,size_bytes,created_at,activated_at,archived_at")
    .eq("organization_id", access.organizationId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  if (request.nextUrl.searchParams.get("includeTests") !== "1" || access.role !== "admin") query = query.eq("is_test", false);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
  return NextResponse.json({ ok: true, data: data || [] }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const validationError = validateLegalPdf(body);
  if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  if (!isLegalDocumentType(body.documentType)) return NextResponse.json({ ok: false, error: "invalid_legal_document_type" }, { status: 400 });
  const title = String(body.title || "").trim();
  const versionLabel = String(body.versionLabel || "").trim();
  const storagePath = String(body.storagePath || "").trim();
  const bucket = String(body.bucket || "").trim();
  if (title.length < 3) return NextResponse.json({ ok: false, error: "legal_document_title_required" }, { status: 400 });
  if (!versionLabel) return NextResponse.json({ ok: false, error: "legal_document_version_required" }, { status: 400 });
  if (bucket !== LEGAL_DOCUMENTS_BUCKET) return NextResponse.json({ ok: false, error: "invalid_private_bucket" }, { status: 400 });
  const sizeBytes = Number(body.sizeBytes);
  const verified = await verifyLegalDocumentUpload({ organizationId: access.organizationId, path: storagePath, sizeBytes });
  if (!verified.ok) return NextResponse.json({ ok: false, error: verified.error }, { status: 400 });

  const { data, error } = await getSupabaseAdminClient().rpc("register_legal_document", {
    target_org: access.organizationId,
    document_type_value: body.documentType,
    title_value: title,
    version_label_value: versionLabel,
    file_name_value: sanitizeFileName(String(body.fileName)),
    storage_path_value: storagePath,
    size_bytes_value: sizeBytes,
    checksum_value: typeof body.checksum === "string" ? body.checksum : "",
    activate_value: body.activate === true,
    is_test_value: body.isTest === true,
    actor: access.actorId,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data }, { headers: NO_STORE_HEADERS });
}
