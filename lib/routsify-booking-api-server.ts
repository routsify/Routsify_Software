import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { loadThirdPartyIntegrationConfig, type BookingAuthMode } from "@/lib/third-party-integration-config-server";

export type BookingApiSlot = {
  startsAt: string;
  endsAt: string | null;
  available: boolean;
  label: string;
  raw: Record<string, unknown>;
};

export type NormalizedRemoteBooking = {
  externalBookingId: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  bookingUrl: string | null;
  meetingUrl: string | null;
  raw: Record<string, unknown>;
};

type BookingApiRequest = {
  organizationId: string;
  path?: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: Record<string, unknown>;
};

class BookingApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "BookingApiError";
    this.status = status;
    this.payload = payload;
  }
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function pathUrl(baseUrl: string, path = "") {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const cleanPath = path.trim();
  if (!cleanPath) return cleanBase;
  if (/^https:\/\//i.test(cleanPath)) return cleanPath;
  return `${cleanBase}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
}

function authHeaders(apiKey: string, mode: BookingAuthMode) {
  if (mode === "bearer") return { Authorization: `Bearer ${apiKey}` };
  return { "X-Routsify-API-Key": apiKey };
}

async function readPayload(response: Response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { message: raw.slice(0, 2000) };
  }
}

async function bookingApiRequest(input: BookingApiRequest) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const config = configuration.booking;
  if (!config.enabled) throw new BookingApiError(503, "booking_integration_disabled", null);
  if (!config.baseUrl) throw new BookingApiError(503, "booking_base_url_not_configured", null);
  const apiKey = await getOrganizationSecret(input.organizationId, "booking_api_key");
  if (!apiKey) throw new BookingApiError(503, "booking_api_key_not_configured", null);

  const url = new URL(pathUrl(config.baseUrl, input.path));
  for (const [key, value] of Object.entries(input.query || {})) {
    if (value !== null && value !== undefined && String(value) !== "") url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: input.method || "GET",
      headers: {
        Accept: "application/json",
        ...(input.body ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(apiKey, config.authMode),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      const payloadObject = object(payload);
      const message = text(payloadObject?.message || payloadObject?.error || payloadObject?.code) || `booking_http_${response.status}`;
      throw new BookingApiError(response.status, message, payload);
    }
    return { status: response.status, payload, config };
  } catch (error) {
    if (error instanceof BookingApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new BookingApiError(504, "booking_api_timeout", null);
    throw new BookingApiError(424, error instanceof Error ? error.message : "booking_api_request_failed", null);
  } finally {
    clearTimeout(timeout);
  }
}

function routeList(payload: unknown) {
  const root = object(payload);
  const routes = object(root?.routes);
  if (!routes) return [] as string[];
  return Object.keys(routes).sort();
}

function unwrapRecord(payload: unknown): Record<string, unknown> {
  const root = object(payload) || {};
  for (const key of ["booking", "reservation", "appointment", "data", "item", "result"]) {
    const nested = object(root[key]);
    if (nested) return nested;
  }
  return root;
}

function findArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = object(payload);
  if (!root) return [];
  for (const key of ["slots", "availability", "bookings", "reservations", "appointments", "items", "results", "data"]) {
    const value = root[key];
    if (Array.isArray(value)) return value;
    const nested = object(value);
    if (nested) {
      const nestedArray = findArray(nested);
      if (nestedArray.length) return nestedArray;
    }
  }
  return [];
}

function isoOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

export function normalizeRemoteBooking(payload: unknown): NormalizedRemoteBooking {
  const row = unwrapRecord(payload);
  const externalBookingId = text(row.external_booking_id || row.booking_id || row.appointment_id || row.id || row.uuid);
  const startsAt = isoOrNull(row.starts_at || row.start_at || row.start || row.start_time || row.datetime);
  const endsAt = isoOrNull(row.ends_at || row.end_at || row.end || row.end_time);
  const status = text(row.status || row.state) || "scheduled";
  const bookingUrl = text(row.booking_url || row.manage_url || row.reschedule_url || row.url) || null;
  const meetingUrl = text(row.meeting_url || row.video_url || row.join_url || row.location_url) || null;
  return { externalBookingId, startsAt, endsAt, status, bookingUrl, meetingUrl, raw: row };
}

export async function testRoutsifyBookingApi(organizationId: string) {
  try {
    const result = await bookingApiRequest({ organizationId });
    const routes = routeList(result.payload);
    return {
      ok: true as const,
      status: result.status,
      baseUrl: result.config.booking.baseUrl,
      authMode: result.config.booking.authMode,
      routes,
      configuredEndpoints: {
        availability: result.config.booking.availabilityPath,
        bookings: result.config.booking.bookingsPath,
        booking: result.config.booking.bookingPathTemplate,
      },
      payload: routes.length ? undefined : result.payload,
    };
  } catch (error) {
    const failure = error instanceof BookingApiError ? error : new BookingApiError(500, error instanceof Error ? error.message : "booking_test_failed", null);
    return { ok: false as const, status: failure.status, error: failure.message, payload: failure.payload };
  }
}

export async function listRemoteBookingAvailability(input: {
  organizationId: string;
  from: string;
  to: string;
  timezone?: string;
  durationMinutes?: number;
}) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const timezone = input.timezone || configuration.booking.defaultTimezone;
  const duration = input.durationMinutes || configuration.booking.defaultDurationMinutes;
  const result = await bookingApiRequest({
    organizationId: input.organizationId,
    path: configuration.booking.availabilityPath,
    query: {
      from: input.from,
      to: input.to,
      date_from: input.from,
      date_to: input.to,
      timezone,
      duration,
      duration_minutes: duration,
    },
  });
  const slots: BookingApiSlot[] = findArray(result.payload).map((value) => {
    const row = object(value) || { value };
    const startsAt = isoOrNull(row.starts_at || row.start_at || row.start || row.datetime || row.time) || text(value);
    const endsAt = isoOrNull(row.ends_at || row.end_at || row.end);
    const availabilityValue = row.available ?? row.is_available ?? row.enabled ?? true;
    return {
      startsAt,
      endsAt,
      available: availabilityValue !== false && text(row.status).toLowerCase() !== "unavailable",
      label: text(row.label || row.title) || startsAt,
      raw: row,
    };
  }).filter((slot) => Boolean(slot.startsAt));
  return { slots, raw: result.payload };
}

export async function createRemoteBooking(input: {
  organizationId: string;
  clientId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string;
  notes?: string | null;
}) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const timezone = input.timezone || configuration.booking.defaultTimezone;
  const result = await bookingApiRequest({
    organizationId: input.organizationId,
    path: configuration.booking.bookingsPath,
    method: "POST",
    body: {
      name: input.name,
      full_name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      starts_at: input.startsAt,
      start: input.startsAt,
      ends_at: input.endsAt || null,
      end: input.endsAt || null,
      timezone,
      notes: input.notes || null,
      source: "routsify_software",
      client_id: input.clientId,
      external_reference: `client:${input.clientId}`,
    },
  });
  return normalizeRemoteBooking(result.payload);
}

export async function updateRemoteBooking(input: {
  organizationId: string;
  externalBookingId: string;
  startsAt?: string;
  endsAt?: string | null;
  timezone?: string;
  notes?: string | null;
  status?: string;
}) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const path = configuration.booking.bookingPathTemplate.replace("{id}", encodeURIComponent(input.externalBookingId));
  const result = await bookingApiRequest({
    organizationId: input.organizationId,
    path,
    method: "PATCH",
    body: {
      ...(input.startsAt ? { starts_at: input.startsAt, start: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { ends_at: input.endsAt, end: input.endsAt } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status ? { status: input.status } : {}),
      source: "routsify_software",
    },
  });
  return normalizeRemoteBooking(result.payload);
}

export async function cancelRemoteBooking(input: { organizationId: string; externalBookingId: string }) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const path = configuration.booking.bookingPathTemplate.replace("{id}", encodeURIComponent(input.externalBookingId));
  try {
    const result = await bookingApiRequest({ organizationId: input.organizationId, path, method: "DELETE" });
    const normalized = normalizeRemoteBooking(result.payload);
    return { ...normalized, externalBookingId: normalized.externalBookingId || input.externalBookingId, status: normalized.status || "cancelled" };
  } catch (error) {
    if (!(error instanceof BookingApiError) || ![404, 405].includes(error.status)) throw error;
    return updateRemoteBooking({ organizationId: input.organizationId, externalBookingId: input.externalBookingId, status: "cancelled" });
  }
}

export async function buildPersonalizedBookingLink(input: {
  organizationId: string;
  clientId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const base = configuration.booking.publicBookingUrl;
  if (!base) throw new Error("booking_public_url_not_configured");
  const url = new URL(base);
  url.searchParams.set("source", "routsify-software");
  url.searchParams.set("client_id", input.clientId);
  if (input.name) url.searchParams.set("name", input.name);
  if (input.email) url.searchParams.set("email", input.email);
  if (input.phone) url.searchParams.set("phone", input.phone);
  return url.toString();
}

export function bookingApiErrorResponse(error: unknown) {
  const failure = error instanceof BookingApiError
    ? error
    : new BookingApiError(500, error instanceof Error ? error.message : "booking_api_error", null);
  return { status: failure.status, error: failure.message, payload: failure.payload };
}
