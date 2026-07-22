import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { BRAND_ASSETS_BUCKET } from "@/lib/storage-server";

async function saveSetting(organizationId: string, key: string, value: string, actorId: string) {
  return getSupabaseAdminClient().from("routsify_settings").upsert({ organization_id: organizationId, module: "appearance", key, value, default_value: "", value_type: "string", scope: "global", editable: true, requires_recalculation: false, affected_modules: ["all"], updated_by: actorId, updated_at: new Date().toISOString() }, { onConflict: "organization_id,key" });
}

async function currentPath(organizationId: string) {
  const { data } = await getSupabaseAdminClient().from("routsify_settings").select("value").eq("organization_id", organizationId).eq("key", "company.logo_path").maybeSingle();
  return typeof data?.value === "string" ? data.value : "";
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const path = String(body?.path || "");
  const sizeBytes = Number(body?.sizeBytes || 0);
  if (!path.startsWith(`${access.organizationId}/logo/`) || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: "invalid_logo_upload" }, { status: 400 });
  const db = getSupabaseAdminClient();
  const folder = `${access.organizationId}/logo`;
  const name = path.slice(folder.length + 1);
  const { data: objects, error: listError } = await db.storage.from(BRAND_ASSETS_BUCKET).list(folder, { search: name, limit: 10 });
  const object = objects?.find((item) => item.name === name);
  if (listError || !object || (object.metadata?.size && Number(object.metadata.size) !== sizeBytes)) return NextResponse.json({ ok: false, error: "logo_upload_not_verified" }, { status: 400 });
  const previousPath = await currentPath(access.organizationId);
  const { data: publicData } = db.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path);
  const url = publicData.publicUrl;
  const [urlResult, pathResult] = await Promise.all([saveSetting(access.organizationId, "company.logo_url", url, access.actorId), saveSetting(access.organizationId, "company.logo_path", path, access.actorId)]);
  const error = urlResult.error || pathResult.error;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (previousPath && previousPath !== path && previousPath.startsWith(`${access.organizationId}/logo/`)) await db.storage.from(BRAND_ASSETS_BUCKET).remove([previousPath]);
  await db.from("audit_log").insert({ organization_id: access.organizationId, actor_id: access.actorId, entity_type: "settings", action: "brand.logo_updated", after_data: { path, url } });
  return NextResponse.json({ ok: true, data: { path, url } });
}

export async function DELETE(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  const db = getSupabaseAdminClient();
  const previousPath = await currentPath(access.organizationId);
  const [urlResult, pathResult] = await Promise.all([saveSetting(access.organizationId, "company.logo_url", "", access.actorId), saveSetting(access.organizationId, "company.logo_path", "", access.actorId)]);
  const error = urlResult.error || pathResult.error;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (previousPath && previousPath.startsWith(`${access.organizationId}/logo/`)) await db.storage.from(BRAND_ASSETS_BUCKET).remove([previousPath]);
  return NextResponse.json({ ok: true });
}
