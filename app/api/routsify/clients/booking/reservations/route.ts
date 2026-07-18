import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { bookingApiErrorResponse, createRemoteBooking } from "@/lib/routsify-booking-api-server";
import { loadBookingClient, persistRemoteBooking } from "@/lib/routsify-booking-local-server";
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
  if (!clientId || !startsAtRaw) return NextResponse.json({ ok: false, error: "client_id_and_start_required" }, { status: 400 });
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ ok: false, error: "invalid_booking_start" }, { status: 400 });
  if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) return NextResponse.json({ ok: false, error: "booking_start_must_be_future" }, { status: 400 });

  try {
    const [client, configuration] = await Promise.all([
      loadBookingClient(access.organizationId, clientId),
      loadThirdPartyIntegrationConfig(access.organizationId),
    ]);
    const durationMinutes = Math.min(240, Math.max(5, duration || configuration.booking.defaultDurationMinutes));
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000).toISOString();
    const remote = await createRemoteBooking({
      organizationId: access.organizationId,
      clientId,
      name: client.displayName,
      email: client.email,
      phone: client.phone,
      startsAt: startsAt.toISOString(),
      endsAt,
      timezone,
      notes,
    });
    const local = await persistRemoteBooking({
      organizationId: access.organizationId,
      clientId,
      actorId: access.actorId,
      remote,
      eventType: "booking.created",
      requestedPayload: { timezone: timezone || configuration.booking.defaultTimezone, duration_minutes: durationMinutes, notes },
    });
    return NextResponse.json({ ok: true, data: { booking: local, remote } }, { status: 201 });
  } catch (error) {
    const failure = bookingApiErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.error, provider: failure.payload }, { status: failure.status });
  }
}
