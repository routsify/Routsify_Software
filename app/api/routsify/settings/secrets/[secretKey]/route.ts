import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { deleteOrganizationSecret, isOrganizationSecretKey, setOrganizationSecret } from "@/lib/organization-secrets-server";
import { resolveOrganizationId } from "@/lib/request-context";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ secretKey: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  const { secretKey } = await params;
  if (!isOrganizationSecretKey(secretKey)) return NextResponse.json({ ok: false, error: "unsupported_secret" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const value = String(body?.value || "").trim();
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    await setOrganizationSecret({ organizationId, secretKey, value, actorId: access.actorId });
    return NextResponse.json({ ok: true, data: { key: secretKey, configured: true } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "secret_save_failed" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ secretKey: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "admin_required" }, { status: 403 });
  const { secretKey } = await params;
  if (!isOrganizationSecretKey(secretKey)) return NextResponse.json({ ok: false, error: "unsupported_secret" }, { status: 404 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    await deleteOrganizationSecret({ organizationId, secretKey, actorId: access.actorId });
    return NextResponse.json({ ok: true, data: { key: secretKey, configured: false } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "secret_delete_failed" }, { status: 400 });
  }
}
