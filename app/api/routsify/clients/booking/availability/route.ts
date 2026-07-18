import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { bookingApiErrorResponse, listRemoteBookingAvailability } from "@/lib/routsify-booking-api-server";

function validDate(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const from = request.nextUrl.searchParams.get("from") || "";
  const to = request.nextUrl.searchParams.get("to") || "";
  const timezone = request.nextUrl.searchParams.get("timezone") || undefined;
  const durationValue = Number(request.nextUrl.searchParams.get("duration") || 0);
  if (!from || !to || !validDate(from) || !validDate(to)) return NextResponse.json({ ok: false, error: "valid_from_and_to_required" }, { status: 400 });
  if (new Date(to).getTime() <= new Date(from).getTime()) return NextResponse.json({ ok: false, error: "availability_range_invalid" }, { status: 400 });
  if (new Date(to).getTime() - new Date(from).getTime() > 62 * 24 * 60 * 60 * 1000) return NextResponse.json({ ok: false, error: "availability_range_too_large" }, { status: 400 });

  try {
    const data = await listRemoteBookingAvailability({ organizationId: access.organizationId, from, to, timezone, durationMinutes: durationValue || undefined });
    return NextResponse.json({ ok: true, data: { slots: data.slots } });
  } catch (error) {
    const failure = bookingApiErrorResponse(error);
    return NextResponse.json({ ok: false, error: failure.error, provider: failure.payload }, { status: failure.status });
  }
}
