import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createClientRepository } from "@/lib/server-repositories";
import { listOrganizationClients } from "@/lib/organization-repositories";
import { resolveOrganizationId } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await listOrganizationClients(organizationId);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const displayName = String(source.display_name || source.name || "").trim();
  const email = source.email ? String(source.email).trim().toLowerCase() : "";
  const phone = source.phone ? String(source.phone).trim() : "";
  if (displayName.length < 2) return NextResponse.json({ ok: false, error: "client_name_required" }, { status: 400 });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_required" }, { status: 400 });

  const result = await createClientRepository({ ...source, display_name: displayName, email, phone, organization_id: organizationId });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
