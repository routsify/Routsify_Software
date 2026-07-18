import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type BookingAuthMode = "x_api_key" | "bearer";

export type ThirdPartyIntegrationConfig = {
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    fromName: string;
    fromAddress: string;
    replyTo: string;
  };
  whatsapp: {
    enabled: boolean;
    graphVersion: string;
    phoneNumberId: string;
    businessAccountId: string;
  };
  booking: {
    enabled: boolean;
    baseUrl: string;
    publicBookingUrl: string;
    authMode: BookingAuthMode;
    availabilityPath: string;
    bookingsPath: string;
    bookingPathTemplate: string;
    defaultTimezone: string;
    defaultDurationMinutes: number;
  };
};

const defaults: ThirdPartyIntegrationConfig = {
  email: {
    enabled: false,
    smtpHost: "smtp.hostinger.com",
    smtpPort: 465,
    smtpSecure: true,
    fromName: "Routsify",
    fromAddress: "",
    replyTo: "",
  },
  whatsapp: {
    enabled: false,
    graphVersion: "v23.0",
    phoneNumberId: "",
    businessAccountId: "",
  },
  booking: {
    enabled: false,
    baseUrl: "https://call.routsify.com/wp-json/routsify/v1",
    publicBookingUrl: "https://call.routsify.com",
    authMode: "x_api_key",
    availabilityPath: "/availability",
    bookingsPath: "/bookings",
    bookingPathTemplate: "/bookings/{id}",
    defaultTimezone: "Europe/Madrid",
    defaultDurationMinutes: 30,
  },
};

const keys = {
  emailEnabled: "integrations.email.enabled",
  smtpHost: "integrations.email.smtp_host",
  smtpPort: "integrations.email.smtp_port",
  smtpSecure: "integrations.email.smtp_secure",
  fromName: "integrations.email.from_name",
  fromAddress: "integrations.email.from_address",
  replyTo: "integrations.email.reply_to",
  whatsappEnabled: "integrations.whatsapp.enabled",
  graphVersion: "integrations.whatsapp.graph_version",
  phoneNumberId: "integrations.whatsapp.phone_number_id",
  businessAccountId: "integrations.whatsapp.business_account_id",
  bookingEnabled: "integrations.booking.api_enabled",
  bookingBaseUrl: "integrations.booking.base_url",
  bookingPublicUrl: "integrations.booking.public_url",
  bookingAuthMode: "integrations.booking.auth_mode",
  bookingAvailabilityPath: "integrations.booking.availability_path",
  bookingBookingsPath: "integrations.booking.bookings_path",
  bookingPathTemplate: "integrations.booking.booking_path_template",
  bookingTimezone: "integrations.booking.default_timezone",
  bookingDuration: "integrations.booking.default_duration_minutes",
} as const;

function valueOf(row: { value?: unknown } | undefined, fallback: unknown) {
  if (!row || row.value === undefined || row.value === null) return fallback;
  return row.value;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizePath(value: string, fallback: string) {
  const clean = value.trim();
  if (!clean) return fallback;
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export async function loadThirdPartyIntegrationConfig(organizationId: string): Promise<ThirdPartyIntegrationConfig> {
  const { data, error } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value")
    .eq("organization_id", organizationId)
    .in("key", Object.values(keys));
  if (error) throw new Error(error.message);
  const rows = new Map((data || []).map((row) => [String(row.key), row]));
  const text = (key: string, fallback: string) => String(valueOf(rows.get(key), fallback) || "").trim();
  const bool = (key: string, fallback: boolean) => valueOf(rows.get(key), fallback) === true;
  const number = (key: string, fallback: number) => {
    const parsed = Number(valueOf(rows.get(key), fallback));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const authModeValue = text(keys.bookingAuthMode, defaults.booking.authMode);
  return {
    email: {
      enabled: bool(keys.emailEnabled, defaults.email.enabled),
      smtpHost: text(keys.smtpHost, defaults.email.smtpHost),
      smtpPort: Math.min(65535, Math.max(1, number(keys.smtpPort, defaults.email.smtpPort))),
      smtpSecure: bool(keys.smtpSecure, defaults.email.smtpSecure),
      fromName: text(keys.fromName, defaults.email.fromName),
      fromAddress: text(keys.fromAddress, defaults.email.fromAddress),
      replyTo: text(keys.replyTo, defaults.email.replyTo),
    },
    whatsapp: {
      enabled: bool(keys.whatsappEnabled, defaults.whatsapp.enabled),
      graphVersion: text(keys.graphVersion, defaults.whatsapp.graphVersion).replace(/^\/?/, ""),
      phoneNumberId: text(keys.phoneNumberId, defaults.whatsapp.phoneNumberId),
      businessAccountId: text(keys.businessAccountId, defaults.whatsapp.businessAccountId),
    },
    booking: {
      enabled: bool(keys.bookingEnabled, defaults.booking.enabled),
      baseUrl: normalizeBaseUrl(text(keys.bookingBaseUrl, defaults.booking.baseUrl)),
      publicBookingUrl: normalizeBaseUrl(text(keys.bookingPublicUrl, defaults.booking.publicBookingUrl)),
      authMode: authModeValue === "bearer" ? "bearer" : "x_api_key",
      availabilityPath: normalizePath(text(keys.bookingAvailabilityPath, defaults.booking.availabilityPath), defaults.booking.availabilityPath),
      bookingsPath: normalizePath(text(keys.bookingBookingsPath, defaults.booking.bookingsPath), defaults.booking.bookingsPath),
      bookingPathTemplate: normalizePath(text(keys.bookingPathTemplate, defaults.booking.bookingPathTemplate), defaults.booking.bookingPathTemplate),
      defaultTimezone: text(keys.bookingTimezone, defaults.booking.defaultTimezone),
      defaultDurationMinutes: Math.min(240, Math.max(5, number(keys.bookingDuration, defaults.booking.defaultDurationMinutes))),
    },
  };
}

export async function updateThirdPartyIntegrationConfig(input: {
  organizationId: string;
  actorId: string;
  config: Partial<ThirdPartyIntegrationConfig>;
}) {
  const current = await loadThirdPartyIntegrationConfig(input.organizationId);
  const next: ThirdPartyIntegrationConfig = {
    email: { ...current.email, ...(input.config.email || {}) },
    whatsapp: { ...current.whatsapp, ...(input.config.whatsapp || {}) },
    booking: { ...current.booking, ...(input.config.booking || {}) },
  };

  next.booking.baseUrl = normalizeBaseUrl(next.booking.baseUrl);
  next.booking.publicBookingUrl = normalizeBaseUrl(next.booking.publicBookingUrl);
  next.booking.availabilityPath = normalizePath(next.booking.availabilityPath, defaults.booking.availabilityPath);
  next.booking.bookingsPath = normalizePath(next.booking.bookingsPath, defaults.booking.bookingsPath);
  next.booking.bookingPathTemplate = normalizePath(next.booking.bookingPathTemplate, defaults.booking.bookingPathTemplate);

  if (next.email.enabled && (!next.email.smtpHost || !next.email.fromAddress)) throw new Error("email_host_and_from_required");
  if (next.email.smtpPort < 1 || next.email.smtpPort > 65535) throw new Error("invalid_smtp_port");
  if (next.email.fromAddress && !/^\S+@\S+\.\S+$/.test(next.email.fromAddress)) throw new Error("invalid_from_address");
  if (next.email.replyTo && !/^\S+@\S+\.\S+$/.test(next.email.replyTo)) throw new Error("invalid_reply_to");
  if (next.whatsapp.enabled && (!next.whatsapp.graphVersion || !next.whatsapp.phoneNumberId)) throw new Error("whatsapp_version_and_phone_id_required");
  if (next.whatsapp.graphVersion && !/^v\d+\.\d+$/.test(next.whatsapp.graphVersion)) throw new Error("invalid_graph_version");
  if (next.whatsapp.phoneNumberId && !/^\d+$/.test(next.whatsapp.phoneNumberId)) throw new Error("invalid_phone_number_id");
  if (next.whatsapp.businessAccountId && !/^\d+$/.test(next.whatsapp.businessAccountId)) throw new Error("invalid_business_account_id");
  if (next.booking.enabled && !next.booking.baseUrl) throw new Error("booking_base_url_required");
  if (next.booking.baseUrl && !/^https:\/\//i.test(next.booking.baseUrl)) throw new Error("booking_base_url_must_use_https");
  if (next.booking.publicBookingUrl && !/^https:\/\//i.test(next.booking.publicBookingUrl)) throw new Error("booking_public_url_must_use_https");
  if (!next.booking.bookingPathTemplate.includes("{id}")) throw new Error("booking_path_template_requires_id");
  if (!next.booking.defaultTimezone || next.booking.defaultTimezone.length > 100) throw new Error("invalid_booking_timezone");
  if (next.booking.defaultDurationMinutes < 5 || next.booking.defaultDurationMinutes > 240) throw new Error("invalid_booking_duration");

  const rows = [
    [keys.emailEnabled, next.email.enabled, "boolean"],
    [keys.smtpHost, next.email.smtpHost, "string"],
    [keys.smtpPort, next.email.smtpPort, "number"],
    [keys.smtpSecure, next.email.smtpSecure, "boolean"],
    [keys.fromName, next.email.fromName, "string"],
    [keys.fromAddress, next.email.fromAddress, "string"],
    [keys.replyTo, next.email.replyTo, "string"],
    [keys.whatsappEnabled, next.whatsapp.enabled, "boolean"],
    [keys.graphVersion, next.whatsapp.graphVersion, "string"],
    [keys.phoneNumberId, next.whatsapp.phoneNumberId, "string"],
    [keys.businessAccountId, next.whatsapp.businessAccountId, "string"],
    [keys.bookingEnabled, next.booking.enabled, "boolean"],
    [keys.bookingBaseUrl, next.booking.baseUrl, "string"],
    [keys.bookingPublicUrl, next.booking.publicBookingUrl, "string"],
    [keys.bookingAuthMode, next.booking.authMode, "string"],
    [keys.bookingAvailabilityPath, next.booking.availabilityPath, "string"],
    [keys.bookingBookingsPath, next.booking.bookingsPath, "string"],
    [keys.bookingPathTemplate, next.booking.bookingPathTemplate, "string"],
    [keys.bookingTimezone, next.booking.defaultTimezone, "string"],
    [keys.bookingDuration, next.booking.defaultDurationMinutes, "number"],
  ].map(([key, value, valueType]) => ({
    organization_id: input.organizationId,
    module: "integrations",
    key,
    value,
    default_value: value,
    value_type: valueType,
    scope: "global",
    editable: true,
    requires_recalculation: false,
    affected_modules: ["communications", "integrations", "clients", "bookings"],
    updated_by: input.actorId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await getSupabaseAdminClient().from("routsify_settings").upsert(rows, { onConflict: "organization_id,key" });
  if (error) throw new Error(error.message);
  return next;
}
