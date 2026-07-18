import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { buildPersonalizedBookingLink } from "@/lib/routsify-booking-api-server";
import { loadBookingClient, recordBookingLinkAction } from "@/lib/routsify-booking-local-server";
import { sendTransactionalEmail } from "@/lib/smtp-email-server";
import { sendWhatsAppText } from "@/lib/whatsapp-cloud-server";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clientId = text(body?.clientId);
  const channel = text(body?.channel || "copy") as "copy" | "email" | "whatsapp";
  if (!clientId) return NextResponse.json({ ok: false, error: "client_id_required" }, { status: 400 });
  if (!(["copy", "email", "whatsapp"] as const).includes(channel)) return NextResponse.json({ ok: false, error: "invalid_channel" }, { status: 400 });

  try {
    const client = await loadBookingClient(access.organizationId, clientId);
    const url = await buildPersonalizedBookingLink({ organizationId: access.organizationId, clientId, name: client.displayName, email: client.email, phone: client.phone });
    const defaultMessage = `Hola ${client.displayName}, puedes elegir directamente el día y la hora de tu llamada con Routsify desde este enlace: ${url}`;
    const message = text(body?.message) || defaultMessage;
    const subject = text(body?.subject) || "Reserva tu llamada con Routsify";
    let provider: unknown = null;

    if (channel === "email") {
      if (!client.email) return NextResponse.json({ ok: false, error: "client_email_required" }, { status: 400 });
      const result = await sendTransactionalEmail({ organizationId: access.organizationId, to: client.email, subject, body: message });
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      provider = result;
    }
    if (channel === "whatsapp") {
      if (!client.phone) return NextResponse.json({ ok: false, error: "client_phone_required" }, { status: 400 });
      const result = await sendWhatsAppText({ organizationId: access.organizationId, to: client.phone, body: message });
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      provider = result;
    }

    await recordBookingLinkAction({ organizationId: access.organizationId, clientId, actorId: access.actorId, channel, url });
    return NextResponse.json({ ok: true, data: { url, message, subject, channel, provider } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "booking_link_failed" }, { status: 400 });
  }
}
