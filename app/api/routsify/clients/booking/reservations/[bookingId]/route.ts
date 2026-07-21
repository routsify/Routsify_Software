import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { bookingApiErrorResponse, cancelRemoteBooking, updateRemoteBooking } from "@/lib/routsify-booking-api-server";
import { loadManagedBooking, persistRemoteBooking } from "@/lib/routsify-booking-local-server";
import { loadThirdPartyIntegrationConfig } from "@/lib/third-party-integration-config-server";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { bookingId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const startsAtRaw = text(body?.startsAt);
  const timezone = text(body?.timezone) || undefined;
  const notes = body && "notes" in body ? text(body.notes) || null : undefined;
  const duration = Number(body?.durationMinutes || 0);
  if (!startsAtRaw && notes === undefined) return NextResponse.json({ ok: false, error: "booking_update_required" }, { status: 400 });

  try {
    const [local, configuration] = await Promise.all([
      loadManagedBooking(access.organizationId, bookingId),
      loadThirdPartyIntegrationConfig(access.organizationId),
    ]);
    const externalBookingId = text(local.external_booking_id);
    const clientId = text(local.client_id);
    let startsAt: string | undefined;
    let endsAt: string | null | undefined;
    let durationMinutes: number | undefined;
    if (startsAtRaw) {
      const parsed = new Date(startsAtRaw);
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ ok: false, error: "invalid_booking_start" }, { status: 400 });
      if (parsed.getTime() < Date.now() - 5 * 60 * 1000) return NextResponse.json({ ok: false, error: "booking_start_must_be_future" }, { status: 400 });
      durationMinutes = Math.min(240, Math.max(5, duration || configuration.booking.defaultDurationMinutes));
      startsAt = parsed.toISOString();
      endsAt = new Date(parsed.getTime() + durationMinutes * 60 * 1000).toISOString();
    }
    const remote = await updateRemoteBooking({ organizationId: access.organizationId, externalBookingId, startsAt, endsAt, timezone, notes });
    const saved = await persistRemoteBooking({
      organizationId: access.organizationId,
      clientId,
      actorId: access.actorId,
      remote: { ...remote, externalBookingId: remote.externalBookingId || externalBookingId },
      eventType: "booking.updated",
      requestedStartsAt: startsAt,
      requestedEndsAt: endsAt,
      requestedPayload: { timezone: timezone || configuration.booking.defaultTimezone, ...(durationMinutes ? { duration_minutes: durationMinutes } : {}), ...(notes !== undefined ? { notes } : {}) },
    });
    return NextResponse.json({ ok: true, data: { booking: saved, remote } });
  } catch (error) {
    const failure = bookingApiErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.error, provider: failure.payload }, { status: failure.status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { bookingId } = await params;
  try {
    const local = await loadManagedBooking(access.organizationId, bookingId);
    const externalBookingId = text(local.external_booking_id);
    const clientId = text(local.client_id);
    const remote = await cancelRemoteBooking({ organizationId: access.organizationId, externalBookingId });
    const saved = await persistRemoteBooking({
      organizationId: access.organizationId,
      clientId,
      actorId: access.actorId,
      remote: { ...remote, externalBookingId: remote.externalBookingId || externalBookingId, status: "cancelled" },
      eventType: "booking.cancelled",
    });
    return NextResponse.json({ ok: true, data: { booking: saved, remote } });
  } catch (error) {
    const failure = bookingApiErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.error, provider: failure.payload }, { status: failure.status });
  }
}
