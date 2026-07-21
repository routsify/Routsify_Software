import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { normalizeRemoteBooking, type NormalizedRemoteBooking } from "@/lib/routsify-booking-api-server";
import { loadThirdPartyIntegrationConfig } from "@/lib/third-party-integration-config-server";

export class BookingCreationError extends Error {
  constructor(public status: number, message: string, public payload: unknown) {
    super(message);
    this.name = "BookingCreationError";
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function localParts(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BookingCreationError(400, "invalid_booking_start", null);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  const localTime = `${part("hour")}:${part("minute")}`;
  return { localDate, localTime, localDateTime: `${localDate} ${localTime}` };
}

export async function createRemoteBookingWithFormStatus(input: {
  organizationId: string;
  clientId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  notes?: string | null;
  privacyAccepted: boolean;
  initialFormCompleted: boolean;
}): Promise<NormalizedRemoteBooking> {
  if (!input.privacyAccepted) throw new BookingCreationError(400, "booking_privacy_consent_required", null);
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const config = configuration.booking;
  if (!config.enabled) throw new BookingCreationError(503, "booking_integration_disabled", null);
  const apiKey = await getOrganizationSecret(input.organizationId, "booking_api_key");
  if (!apiKey) throw new BookingCreationError(503, "booking_api_key_not_configured", null);

  const base = new URL(config.baseUrl.trim().replace(/\/+$/, ""));
  if (base.protocol !== "https:" || base.hostname.toLowerCase() !== "call.routsify.com" || !base.pathname.startsWith("/wp-json/routsify/v1")) {
    throw new BookingCreationError(400, "booking_api_url_not_allowed", null);
  }
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/${config.bookingsPath.replace(/^\/+/, "")}`;
  const timezone = input.timezone || config.defaultTimezone;
  const { localDate, localTime, localDateTime } = localParts(input.startsAt, timezone);
  const duration = Math.max(5, Math.round((new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 60000) || config.defaultDurationMinutes);
  const formAnswer = input.initialFormCompleted ? "yes" : "no";
  const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json" });
  if (config.authMode === "bearer") headers.set("Authorization", `Bearer ${apiKey}`);
  else headers.set("X-Routsify-API-Key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        full_name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        date: localDate,
        booking_date: localDate,
        start_date: localDate,
        time: localTime,
        booking_time: localTime,
        start_time: localTime,
        datetime: localDateTime,
        starts_at: input.startsAt,
        start: input.startsAt,
        ends_at: input.endsAt,
        end: input.endsAt,
        duration,
        duration_minutes: duration,
        timezone,
        notes: input.notes || null,
        source: "routsify_software",
        client_id: input.clientId,
        external_reference: `client:${input.clientId}`,
        privacy: true,
        privacy_accepted: true,
        privacy_policy_accepted: true,
        privacy_consent: true,
        accept_privacy: true,
        gdpr_consent: true,
        consent: true,
        privacy_accepted_at: new Date().toISOString(),
        consent_source: "routsify_software_admin",
        initial_form: formAnswer,
        initial_form_answer: formAnswer,
        initial_form_completed: formAnswer,
        has_completed_initial_form: input.initialFormCompleted,
        form_completed: input.initialFormCompleted,
        trip_summary: input.initialFormCompleted ? "" : input.notes || "Reserva gestionada desde Routsify Software.",
        message: input.notes || null,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: unknown = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { message: raw.slice(0, 2000) }; }
    if (!response.ok) {
      const row = object(payload);
      throw new BookingCreationError(response.status, text(row?.message || row?.error || row?.code) || `booking_http_${response.status}`, payload);
    }
    return normalizeRemoteBooking(payload);
  } catch (error) {
    if (error instanceof BookingCreationError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new BookingCreationError(504, "booking_api_timeout", null);
    throw new BookingCreationError(424, error instanceof Error ? error.message : "booking_api_request_failed", null);
  } finally {
    clearTimeout(timeout);
  }
}
