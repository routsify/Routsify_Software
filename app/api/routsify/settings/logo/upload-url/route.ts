import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess, sanitizeFileName } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { BRAND_ASSETS_BUCKET } from "@/lib/storage-server";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const mimeType = String(body?.mimeType || "");
  const sizeBytes = Number(body?.sizeBytes || 0);
  if (!allowedTypes.has(mimeType)) return NextResponse.json({ ok: false, error: "invalid_logo_type" }, { status: 400 });
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: "invalid_logo_size" }, { status: 400 });
  const fileName = sanitizeFileName(String(body?.fileName || "logo"));
  const path = `${access.organizationId}/logo/${Date.now()}-${fileName}`;
  const { data, error } = await getSupabaseAdminClient().storage.from(BRAND_ASSETS_BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, bucket: BRAND_ASSETS_BUCKET, path, signedUrl: data.signedUrl, token: data.token });
}
