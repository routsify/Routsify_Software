import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { loadThirdPartyIntegrationConfig, type BookingAuthMode } from "@/lib/third-party-integration-config-server";

export type BookingApiSlot = {
  startsAt: string;
  endsAt: string | null;
  available: boolean;
  label: string;
  durationMinutes: number;
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

const retryableMutationStatuses = new Set([424, 429, 502, 503, 504]);

async function retryBookingMutation<T>(operation: () => Promise<T>, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!(error instanceof BookingApiError) || !retryableMutationStatuses.has(error.status) || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function validatedBaseUrl(value: string) {
  const url = new URL(value.trim().replace(/\/+$/, ""));
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "call.routsify.com") throw new BookingApiError(400, "booking_api_host_not_allowed", null);
  if (!url.pathname.startsWith("/wp-json/routsify/v1")) throw new BookingApiError(400, "booking_api_namespace_not_allowed", null);
  url.search = "";
  url.hash = "";
  return url;
}

function pathUrl(baseUrl: string, path = "") {
  const base = validatedBaseUrl(baseUrl);
  const cleanPath = path.trim();
  if (!cleanPath) return base;
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleanPath) || cleanPath.startsWith("//")) throw new BookingApiError(400, "absolute_booking_path_not_allowed", null);
  const basePath = base.pathname.replace(/\/+$/, "");
  const suffix = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  base.pathname = `${basePath}${suffix}`;
  return base;
}

function authHeaders(apiKey: string, mode: BookingAuthMode, hasBody: boolean) {
  const headers = new Headers({ Accept: "application/json" });
  if (hasBody) headers.set("Content-Type", "application/json");
  if (mode === "bearer") headers.set("Authorization", `Bearer ${apiKey}`);
  else headers.set("X-Routsify-API-Key", apiKey);
  return headers;
}

async function readPayload(response: Response) {
  const raw = await response.text();
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { return { message: raw.slice(0, 2000) }; }
}

async function bookingApiRequest(input: BookingApiRequest) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const config = configuration.booking;
  if (!config.enabled) throw new BookingApiError(503, "booking_integration_disabled", null);
  if (!config.baseUrl) throw new BookingApiError(503, "booking_base_url_not_configured", null);
  const apiKey = await getOrganizationSecret(input.organizationId, "booking_api_key");
  if (!apiKey) throw new BookingApiError(503, "booking_api_key_not_configured", null);
  const url = pathUrl(config.baseUrl, input.path);
  for (const [key, value] of Object.entries(input.query || {})) if (value !== null && value !== undefined && String(value) !== "") url.searchParams.set(key, String(value));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: input.method || "GET",
      headers: authHeaders(apiKey, config.authMode, Boolean(input.body)),
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      const row = object(payload);
      throw new BookingApiError(response.status, text(row?.message || row?.error || row?.code) || `booking_http_${response.status}`, payload);
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
  const routes = object(object(payload)?.routes);
  return routes ? Object.keys(routes).sort() : [];
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
      const found = findArray(nested);
      if (found.length) return found;
    }
  }
  return [];
}

function findNamedArray(payload: unknown, key: string, depth = 0): unknown[] {
  if (depth > 4) return [];
  const root = object(payload);
  if (!root) return [];
  if (Array.isArray(root[key])) return root[key] as unknown[];
  for (const value of Object.values(root)) {
    if (!object(value)) continue;
    const found = findNamedArray(value, key, depth + 1);
    if (found.length) return found;
  }
  return [];
}

function providerDurationMinutes(payload: unknown, fallback: number, depth = 0): number {
  if (depth > 4) return fallback;
  const root = object(payload);
  if (!root) return fallback;
  const duration = Number(root.duration_minutes || root.duration || 0);
  if (Number.isFinite(duration) && duration >= 5 && duration <= 240) return duration;
  for (const value of Object.values(root)) {
    if (!object(value)) continue;
    const nested = providerDurationMinutes(value, 0, depth + 1);
    if (nested >= 5 && nested <= 240) return nested;
  }
  return fallback;
}

function isoOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function providerUtcIsoOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(raw)
    ? `${raw.replace(" ", "T")}Z`
    : raw;
  return isoOrNull(normalized);
}

function zonedParts(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BookingApiError(400, "invalid_booking_start", null);
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

function durationBetween(startsAt: string, endsAt?: string | null) {
  if (!endsAt) return 30;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const minutes = Math.round((end - start) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
}

export function normalizeRemoteBooking(payload: unknown): NormalizedRemoteBooking {
  const row = unwrapRecord(payload);
  return {
    externalBookingId: text(row.external_booking_id || row.booking_id || row.appointment_id || row.id || row.uuid),
    startsAt: providerUtcIsoOrNull(row.start_utc) || isoOrNull(row.starts_at || row.start_at || row.start || row.start_time || row.datetime || row.date),
    endsAt: providerUtcIsoOrNull(row.end_utc) || isoOrNull(row.ends_at || row.end_at || row.end || row.end_time),
    status: text(row.status || row.state) || "scheduled",
    bookingUrl: text(row.booking_url || row.manage_url || row.reschedule_url || row.url) || null,
    meetingUrl: text(row.meeting_url || row.video_url || row.join_url || row.location_url) || null,
    raw: row,
  };
}

export async function testRoutsifyBookingApi(organizationId: string) {
  try {
    const result = await bookingApiRequest({ organizationId });
    const routes = routeList(result.payload);
    return {
      ok: true as const,
      status: result.status,
      baseUrl: result.config.baseUrl,
      authMode: result.config.authMode,
      routes,
      configuredEndpoints: { availability: result.config.availabilityPath, bookings: result.config.bookingsPath, booking: result.config.bookingPathTemplate },
      payload: routes.length ? undefined : result.payload,
    };
  } catch (error) {
    const failure = error instanceof BookingApiError ? error : new BookingApiError(500, error instanceof Error ? error.message : "booking_test_failed", null);
    return { ok: false as const, status: failure.status, error: failure.message, payload: failure.payload };
  }
}

export async function listRemoteBookingAvailability(input: { organizationId: string; from: string; to: string; timezone?: string; durationMinutes?: number }) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const timezone = input.timezone || configuration.booking.defaultTimezone;
  const duration = input.durationMinutes || configuration.booking.defaultDurationMinutes;
  const fromParts = zonedParts(input.from, timezone);
  const toParts = zonedParts(input.to, timezone);
  const result = await bookingApiRequest({
    organizationId: input.organizationId,
    path: configuration.booking.availabilityPath,
    query: {
      from: input.from,
      to: input.to,
      date_from: fromParts.localDate,
      date_to: toParts.localDate,
      start_date: fromParts.localDate,
      end_date: toParts.localDate,
      timezone,
      duration,
      duration_minutes: duration,
    },
  });
  let slotValues = findNamedArray(result.payload, "slots");
  const dateValues = findNamedArray(result.payload, "dates");
  let providerDuration = providerDurationMinutes(result.payload, duration);

  if (!slotValues.length && dateValues.length) {
    const availableDates = dateValues.map((value) => object(value) || { value }).filter((row) => {
      const date = text(row.date || row.value);
      const available = row.available ?? row.is_available ?? true;
      const slotsCount = Number(row.slots_count ?? 1);
      return /^\d{4}-\d{2}-\d{2}$/.test(date)
        && date >= fromParts.localDate
        && date <= toParts.localDate
        && available !== false
        && (!Number.isFinite(slotsCount) || slotsCount > 0);
    }).slice(0, 8);
    const daily = await Promise.all(availableDates.map((row) => bookingApiRequest({
      organizationId: input.organizationId,
      path: configuration.booking.availabilityPath,
      query: {
        date: text(row.date || row.value),
        timezone,
        duration,
        duration_minutes: duration,
      },
    })));
    slotValues = daily.flatMap((item) => findNamedArray(item.payload, "slots"));
    providerDuration = daily.reduce((current, item) => providerDurationMinutes(item.payload, current), providerDuration);
  }

  if (!slotValues.length && !dateValues.length) slotValues = findArray(result.payload);
  const slots: BookingApiSlot[] = slotValues.map((value) => {
    const row = object(value) || { value };
    const startsAt = providerUtcIsoOrNull(row.start_utc) || isoOrNull(row.starts_at || row.start_at || row.start || row.datetime);
    const endsAt = providerUtcIsoOrNull(row.end_utc) || isoOrNull(row.ends_at || row.end_at || row.end);
    const availabilityValue = row.available ?? row.is_available ?? row.enabled ?? true;
    const slotDuration = providerDurationMinutes(row, providerDuration);
    return startsAt ? { startsAt, endsAt, available: availabilityValue !== false && text(row.status).toLowerCase() !== "unavailable", label: text(row.label || row.title) || startsAt, durationMinutes: slotDuration, raw: row } : null;
  }).filter((slot): slot is BookingApiSlot => Boolean(slot));
  return { slots, raw: result.payload, durationMinutes: providerDuration };
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
  privacyAccepted: boolean;
}) {
  if (!input.privacyAccepted) throw new BookingApiError(400, "booking_privacy_consent_required", null);
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const timezone = input.timezone || configuration.booking.defaultTimezone;
  const { localDate, localTime, localDateTime } = zonedParts(input.startsAt, timezone);
  const duration = durationBetween(input.startsAt, input.endsAt);
  const privacyAcceptedAt = new Date().toISOString();
  const result = await bookingApiRequest({
    organizationId: input.organizationId,
    path: configuration.booking.bookingsPath,
    method: "POST",
    body: {
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
      ends_at: input.endsAt || null,
      end: input.endsAt || null,
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
      privacy_accepted_at: privacyAcceptedAt,
      consent_source: "routsify_software_admin",
    },
  });
  return normalizeRemoteBooking(result.payload);
}

export async function updateRemoteBooking(input: { organizationId: string; externalBookingId: string; startsAt?: string; endsAt?: string | null; timezone?: string; notes?: string | null; status?: string }) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const path = configuration.booking.bookingPathTemplate.replace("{id}", encodeURIComponent(input.externalBookingId));
  const timezone = input.timezone || configuration.booking.defaultTimezone;
  const parts = input.startsAt ? zonedParts(input.startsAt, timezone) : null;
  const result = await retryBookingMutation(() => bookingApiRequest({
    organizationId: input.organizationId,
    path,
    method: "PATCH",
    body: {
      ...(input.startsAt ? { date: parts?.localDate, time: parts?.localTime, datetime: parts?.localDateTime, starts_at: input.startsAt, start: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { ends_at: input.endsAt, end: input.endsAt } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status ? { status: input.status } : {}),
      source: "routsify_software",
    },
  }));
  return normalizeRemoteBooking(result.payload);
}

export async function cancelRemoteBooking(input: { organizationId: string; externalBookingId: string }) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const path = configuration.booking.bookingPathTemplate.replace("{id}", encodeURIComponent(input.externalBookingId));
  try {
    const result = await retryBookingMutation(() => bookingApiRequest({ organizationId: input.organizationId, path, method: "DELETE" }));
    const normalized = normalizeRemoteBooking(result.payload);
    return { ...normalized, externalBookingId: normalized.externalBookingId || input.externalBookingId, status: normalized.status || "cancelled" };
  } catch (error) {
    if (!(error instanceof BookingApiError) || ![404, 405].includes(error.status)) throw error;
    try {
      const result = await retryBookingMutation(() => bookingApiRequest({ organizationId: input.organizationId, path: `${path.replace(/\/+$/, "")}/cancel`, method: "POST", body: { source: "routsify_software" } }));
      const normalized = normalizeRemoteBooking(result.payload);
      return { ...normalized, externalBookingId: normalized.externalBookingId || input.externalBookingId, status: "cancelled" };
    } catch (cancelError) {
      if (!(cancelError instanceof BookingApiError) || ![404, 405].includes(cancelError.status)) throw cancelError;
      return updateRemoteBooking({ organizationId: input.organizationId, externalBookingId: input.externalBookingId, status: "cancelled" });
    }
  }
}

export async function buildPersonalizedBookingLink(input: { organizationId: string; clientId: string; name: string; email?: string | null; phone?: string | null }) {
  const configuration = await loadThirdPartyIntegrationConfig(input.organizationId);
  const url = new URL(configuration.booking.publicBookingUrl);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "call.routsify.com") throw new Error("booking_public_url_not_allowed");
  url.searchParams.set("source", "routsify-software");
  url.searchParams.set("client_id", input.clientId);
  if (input.name) url.searchParams.set("name", input.name);
  if (input.email) url.searchParams.set("email", input.email);
  if (input.phone) url.searchParams.set("phone", input.phone);
  return url.toString();
}

export function bookingApiErrorResponse(error: unknown) {
  const failure = error instanceof BookingApiError ? error : new BookingApiError(500, error instanceof Error ? error.message : "booking_api_error", null);
  return { status: failure.status, error: failure.message, payload: failure.payload };
}
