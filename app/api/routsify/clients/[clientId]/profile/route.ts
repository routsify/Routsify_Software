import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getRequestUserId, resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

const SEGMENTS = new Set(["standard", "priority", "vip", "corporate", "dormant"]);
const RELATIONSHIPS = new Set(["active", "nurture", "dormant", "do_not_contact"]);
const CHANNELS = new Set(["whatsapp", "email", "phone"]);
const RISKS = new Set(["low", "medium", "high"]);

function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function stringList(value: unknown, maxItems = 20, maxLength = 60) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(source.map((item) => text(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function optionalDate(value: unknown) {
  const raw = text(value, 10);
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function optionalTimestamp(value: unknown) {
  const raw = text(value, 40);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function cleanPreferences(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    travel_style: text(source.travel_style, 40),
    pace: text(source.pace, 40),
    accommodation: text(source.accommodation, 80),
    budget_band: text(source.budget_band, 40),
    preferred_departure_airport: text(source.preferred_departure_airport, 80),
    interests: stringList(source.interests, 20, 50),
    preferred_destinations: stringList(source.preferred_destinations, 20, 80),
    avoid_destinations: stringList(source.avoid_destinations, 20, 80),
    family_notes: text(source.family_notes, 1000),
    accessibility_notes: text(source.accessibility_notes, 1000),
    service_notes: text(source.service_notes, 1000),
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  if (!hasSupabaseAdminEnv()) return NextResponse.json({ ok: false, error: "supabase_admin_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const segment = text(source.segment, 30) || "standard";
  const relationshipStatus = text(source.relationship_status, 30) || "active";
  const preferredContactChannel = text(source.preferred_contact_channel, 30) || "whatsapp";
  const riskLevel = text(source.risk_level, 20) || "low";
  const nextOpportunityAt = optionalDate(source.next_opportunity_at);
  const lastContactAt = optionalTimestamp(source.last_contact_at);

  if (!SEGMENTS.has(segment)) return NextResponse.json({ ok: false, error: "invalid_segment" }, { status: 400 });
  if (!RELATIONSHIPS.has(relationshipStatus)) return NextResponse.json({ ok: false, error: "invalid_relationship_status" }, { status: 400 });
  if (!CHANNELS.has(preferredContactChannel)) return NextResponse.json({ ok: false, error: "invalid_preferred_channel" }, { status: 400 });
  if (!RISKS.has(riskLevel)) return NextResponse.json({ ok: false, error: "invalid_risk_level" }, { status: 400 });
  if (nextOpportunityAt === undefined) return NextResponse.json({ ok: false, error: "invalid_next_opportunity_date" }, { status: 400 });
  if (lastContactAt === undefined) return NextResponse.json({ ok: false, error: "invalid_last_contact_date" }, { status: 400 });

  const { clientId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const now = new Date().toISOString();
  const payload = {
    segment,
    relationship_status: relationshipStatus,
    preferred_contact_channel: preferredContactChannel,
    risk_level: riskLevel,
    tags: stringList(source.tags),
    travel_preferences: cleanPreferences(source.travel_preferences),
    next_opportunity_at: nextOpportunityAt,
    last_contact_at: lastContactAt,
    profile_updated_at: now,
    updated_at: now,
  };

  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("clients")
    .update(payload)
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });

  await db.from("timeline_events").insert({
    organization_id: organizationId,
    client_id: clientId,
    event_type: "client.profile_updated",
    title: "Perfil comercial y preferencias actualizados",
    payload: {
      segment,
      relationship_status: relationshipStatus,
      preferred_contact_channel: preferredContactChannel,
      risk_level: riskLevel,
      tags: payload.tags,
    },
    created_by: actorId,
  });

  return NextResponse.json({ ok: true, data });
}
