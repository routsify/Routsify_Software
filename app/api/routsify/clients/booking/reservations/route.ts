import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { BookingCreationError, createRemoteBookingWithFormStatus } from "@/lib/routsify-booking-create-server";
import { loadBookingClient, persistRemoteBooking } from "@/lib/routsify-booking-local-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadThirdPartyIntegrationConfig } from "@/lib/third-party-integration-config-server";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clientId = text(body?.clientId);
  const startsAtRaw = text(body?.startsAt);
  const timezone = text(body?.timezone) || undefined;
  const notes = text(body?.notes) || null;
  const duration = Number(body?.durationMinutes || 0);
  const privacyAccepted = body?.privacyAccepted === true;
  if (!clientId || !startsAtRaw) return NextResponse.json({ ok: false, error: "client_id_and_start_required" }, { status: 400 });
  if (!privacyAccepted) return NextResponse.json({ ok: false, error: "booking_privacy_consent_required" }, { status: 400 });
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ ok: false, error: "invalid_booking_start" }, { status: 400 });
  if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) return NextResponse.json({ ok: false, error: "booking_start_must_be_future" }, { status: 400 });

  try {
    const db = getSupabaseAdminClient();
    const [client, configuration, formLead] = await Promise.all([
      loadBookingClient(access.organizationId, clientId),
      loadThirdPartyIntegrationConfig(access.organizationId),
      db.from("leads").select("id").eq("organization_id", access.organizationId).eq("client_id", clientId).ilike("source", "fillout").limit(1).maybeSingle(),
    ]);
    const initialFormCompleted = Boolean(formLead.data?.id);
    const durationMinutes = Math.min(240, Math.max(5, duration || configuration.booking.defaultDurationMinutes));
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000).toISOString();
    const remote = await createRemoteBookingWithFormStatus({
      organizationId: access.organizationId,
      clientId,
      name: client.displayName,
      email: client.email,
      phone: client.phone,
      startsAt: startsAt.toISOString(),
      endsAt,
      timezone,
      notes,
      privacyAccepted,
      initialFormCompleted,
    });
    const privacyAcceptedAt = new Date().toISOString();
    const local = await persistRemoteBooking({
      organizationId: access.organizationId,
      clientId,
      actorId: access.actorId,
      remote,
      eventType: "booking.created",
      requestedPayload: {
        timezone: timezone || configuration.booking.defaultTimezone,
        duration_minutes: durationMinutes,
        notes,
        privacy_accepted: true,
        privacy_accepted_at: privacyAcceptedAt,
        privacy_acceptance_source: "routsify_software_admin",
        initial_form_completed: initialFormCompleted,
        initial_form_status_source: initialFormCompleted ? "fillout_lead" : "no_fillout_lead",
      },
    });
    return NextResponse.json({ ok: true, data: { booking: local, remote, initialFormCompleted } }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingCreationError) {
      return NextResponse.json({ ok: false, error: error.message, provider: error.payload }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "booking_api_error" }, { status: 500 });
  }
}
