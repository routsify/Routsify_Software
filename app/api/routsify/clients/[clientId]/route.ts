import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";
import { enqueueOutboxEvent } from "@/lib/outbox-server";

function normalizedPhone(value: unknown) {
  return String(value || "").replace(/\D/g, "") || null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const { clientId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data, error } = await getSupabaseAdminClient()
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const { clientId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const displayName = String(source.display_name || "").trim();
  const email = String(source.email || "").trim().toLowerCase();
  const phone = String(source.phone || "").trim();
  const country = String(source.country || "ES").trim().toUpperCase();
  const clientType = String(source.client_type || "person");

  if (displayName.length < 2) return NextResponse.json({ ok: false, error: "client_name_required" }, { status: 400 });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  if (!new Set(["person", "company"]).has(clientType)) return NextResponse.json({ ok: false, error: "invalid_client_type" }, { status: 400 });
  if (country.length !== 2) return NextResponse.json({ ok: false, error: "invalid_country" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const payload = {
    display_name: displayName,
    email: email || null,
    email_normalized: email || null,
    phone: phone || null,
    phone_normalized: normalizedPhone(phone),
    client_type: clientType,
    tax_id: String(source.tax_id || "").trim() || null,
    billing_address: source.billing_address && typeof source.billing_address === "object" ? source.billing_address : {},
    country,
    notes: String(source.notes || "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });

  await supabase.from("timeline_events").insert({
    organization_id: organizationId,
    client_id: clientId,
    event_type: "client.updated",
    title: "Ficha de cliente actualizada",
    payload: { changed_fields: Object.keys(payload) },
    created_by: actorId,
  });
  await enqueueOutboxEvent({ organizationId, channel: "holded", eventType: "contact.sync", idempotencyKey: `holded-contact:${organizationId}:${clientId}:${data.updated_at || Date.now()}`, payload: { client_id: clientId }, risk: "low", businessRule: "Actualizar el contacto de Holded tras cambiar la ficha fiscal o comercial.", nextAction: "Actualizar contacto en Holded." });

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const { clientId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: client, error: clientError } = await supabase.from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (clientError) return NextResponse.json({ ok: false, error: clientError.message }, { status: 400 });
  if (!client) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });

  const [cases, documents, billing, fiscal] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("client_id", clientId),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("owner_type", "client").eq("owner_id", clientId),
    supabase.from("billing_documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("client_id", clientId),
    supabase.from("fiscal_documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("client_id", clientId),
  ]);
  const dependencyError = [cases.error, documents.error, billing.error, fiscal.error].find(Boolean);
  if (dependencyError) return NextResponse.json({ ok: false, error: dependencyError.message }, { status: 400 });

  const blockers = {
    cases: cases.count || 0,
    documents: documents.count || 0,
    fiscal_documents: (billing.count || 0) + (fiscal.count || 0),
  };
  if (Object.values(blockers).some((count) => count > 0)) {
    return NextResponse.json({ ok: false, error: "client_has_protected_history", blockers }, { status: 409 });
  }

  const { error: deleteError } = await supabase.from("clients")
    .delete()
    .eq("id", clientId)
    .eq("organization_id", organizationId);
  if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 400 });

  const deletedAt = new Date().toISOString();
  const { data: cancelledOutbox, error: cancelOutboxError } = await supabase
    .from("integration_outbox")
    .update({
      status: "done",
      sync_status: "synced",
      processed_at: deletedAt,
      last_synced_at: deletedAt,
      last_error: null,
      next_action: "Sincronización cancelada: el cliente se eliminó antes de procesar el evento.",
      next_attempt_at: null,
      locked_at: null,
      locked_by: null,
    })
    .eq("organization_id", organizationId)
    .eq("event_type", "contact.sync")
    .in("status", ["pending", "queued", "failed"])
    .contains("payload", { client_id: clientId })
    .select("id");

  await supabase.from("audit_log").insert({
    organization_id: organizationId,
    actor_id: await getRequestUserId(request),
    action: "client.deleted",
    entity_type: "client",
    entity_id: clientId,
    before_data: client,
    after_data: {
      deleted: true,
      cancelled_contact_sync_events: cancelledOutbox?.length || 0,
      contact_sync_cleanup_error: cancelOutboxError?.message || null,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: { id: clientId, display_name: client.display_name },
    cancelled_contact_sync_events: cancelledOutbox?.length || 0,
  });
}
