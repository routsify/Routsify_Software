import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createClientRepository } from "@/lib/server-repositories";
import { listOrganizationClients, listOrganizationClientsPage } from "@/lib/organization-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { enqueueOutboxEvent } from "@/lib/outbox-server";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const params = request.nextUrl.searchParams;
  const paginated = params.get("paginated") === "1" || params.has("page") || params.has("pageSize") || params.has("q");
  const result = paginated
    ? await listOrganizationClientsPage(organizationId, {
        page: Number(params.get("page") || 1),
        pageSize: Number(params.get("pageSize") || 50),
        query: params.get("q") || "",
      })
    : await listOrganizationClients(organizationId);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const displayName = String(source.display_name || source.name || "").trim();
  const email = source.email ? String(source.email).trim().toLowerCase() : "";
  const phone = source.phone ? String(source.phone).trim() : "";
  const phoneNormalized = phone.replace(/[^0-9]/g, "");
  if (displayName.length < 2) return NextResponse.json({ ok: false, error: "client_name_required" }, { status: 400 });
  if (email && !email.includes("@")) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  if (!organizationId) return NextResponse.json({ ok: false, error: "organization_required" }, { status: 400 });

  const admin = getSupabaseAdminClient();
  if (email) {
    const { data: existingEmail } = await admin.from("clients").select("id,display_name").eq("organization_id", organizationId).eq("email_normalized", email).maybeSingle();
    if (existingEmail) return NextResponse.json({ ok: false, error: "client_already_exists", client_id: existingEmail.id, display_name: existingEmail.display_name }, { status: 409 });
  }
  if (phoneNormalized) {
    const { data: existingPhone } = await admin.from("clients").select("id,display_name").eq("organization_id", organizationId).eq("phone_normalized", phoneNormalized).maybeSingle();
    if (existingPhone) return NextResponse.json({ ok: false, error: "client_already_exists", client_id: existingPhone.id, display_name: existingPhone.display_name }, { status: 409 });
  }

  const result = await createClientRepository({ ...source, display_name: displayName, email, phone, organization_id: organizationId });
  if (result.ok && result.data && typeof result.data === "object" && "id" in result.data) {
    const clientId = String((result.data as { id?: unknown }).id || "");
    if (clientId) await enqueueOutboxEvent({ organizationId, channel: "holded", eventType: "contact.sync", idempotencyKey: `holded-contact:${organizationId}:${clientId}`, payload: { client_id: clientId }, risk: "low", businessRule: "Mantener el contacto de Holded alineado con Routsify.", nextAction: "Crear o actualizar contacto en Holded." });
  }
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
