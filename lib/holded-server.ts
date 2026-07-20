import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type HoldedRequest = {
  organizationId: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
};

const HOLDED_API_ORIGIN = "https://api.holded.com";

export const holdedModuleDefaults = {
  contacts: "/api/v2/contacts",
  estimates: "/api/v2/estimates",
  proformas: "/api/v2/proformas",
  invoices: "/api/v2/invoices",
  purchases: "/api/v2/purchases",
  payments: "/api/v2/payments",
} as const;

export const holdedModuleScopes = {
  contacts: { read: "contacts:contacts.read", write: "contacts:contacts.write" },
  estimates: { read: "sales:estimates.read", write: "sales:estimates.write" },
  proformas: { read: "sales:proforms.read", write: "sales:proforms.write" },
  invoices: { read: "sales:invoices.read", write: "sales:invoices.write" },
  purchases: { read: "accounting:purchases.read", write: "accounting:purchases.write" },
  payments: { read: "accounting:payments.read", write: "accounting:payments.write" },
} as const;

export type HoldedModule = keyof typeof holdedModuleDefaults;

function settingText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "value" in value) return String((value as { value?: unknown }).value || "").trim();
  return "";
}

function normalizeBaseUrl(value: string) {
  try {
    const url = new URL(value || HOLDED_API_ORIGIN);
    if (url.protocol !== "https:" || url.hostname !== "api.holded.com") return HOLDED_API_ORIGIN;
    return HOLDED_API_ORIGIN;
  } catch {
    return HOLDED_API_ORIGIN;
  }
}

function normalizeModulePath(module: HoldedModule, value: string) {
  const fallback = holdedModuleDefaults[module];
  const path = value.trim();
  if (!path || !path.startsWith("/api/v2/")) return fallback;
  return path.replace(/\/+$/, "");
}

export async function holdedConfiguration(organizationId: string) {
  const keys = ["integrations.holded.base_url", ...Object.keys(holdedModuleDefaults).map((module) => `integrations.holded.endpoint.${module}`)];
  const { data, error } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value")
    .eq("organization_id", organizationId)
    .in("key", keys);
  if (error) throw new Error(error.message);
  const values = new Map((data || []).map((row) => [String(row.key), settingText(row.value)]));
  const baseUrl = normalizeBaseUrl(values.get("integrations.holded.base_url") || process.env.HOLDED_API_BASE_URL || HOLDED_API_ORIGIN);
  const endpoints = Object.fromEntries(
    (Object.keys(holdedModuleDefaults) as HoldedModule[]).map((module) => [module, normalizeModulePath(module, values.get(`integrations.holded.endpoint.${module}`) || "")]),
  ) as Record<HoldedModule, string>;
  return { apiVersion: "v2" as const, authMode: "bearer" as const, baseUrl, endpoints };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorDetail(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const row = payload as Record<string, unknown>;
  const detail = row.detail || row.message || row.title || row.error;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(row.errors) && row.errors.length) return JSON.stringify(row.errors).slice(0, 800);
  return fallback;
}

function rateLimitHeaders(headers: Headers) {
  return {
    limit: headers.get("x-ratelimit-limit"),
    remaining: headers.get("x-ratelimit-remaining"),
    reset: headers.get("x-ratelimit-reset"),
    window: headers.get("x-ratelimit-window"),
    retryAfter: headers.get("retry-after"),
  };
}

export async function holdedRequest(input: HoldedRequest) {
  const apiKey = await getOrganizationSecret(input.organizationId, "holded_api_key");
  if (!apiKey) return { ok: false as const, mode: "unconfigured" as const, status: 503, error: "holded_api_key_not_configured", detail: "No hay una API Key de Holded guardada.", payload: null, rateLimit: null };
  const { baseUrl } = await holdedConfiguration(input.organizationId);
  const method = input.method || "GET";
  const timeoutMs = Math.min(Math.max(input.timeoutMs || 15_000, 2_000), 30_000);
  const defaultRetries = method === "GET" ? 2 : 0;
  const retries = Math.min(Math.max(input.retries ?? defaultRetries, 0), 4);
  let lastStatus = 0;
  let lastPayload: unknown = null;
  let lastRateLimit: ReturnType<typeof rateLimitHeaders> | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(input.body ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "Routsify-Software/1.0",
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      const responseText = await response.text();
      try { lastPayload = responseText ? JSON.parse(responseText) : null; } catch { lastPayload = responseText; }
      lastStatus = response.status;
      lastRateLimit = rateLimitHeaders(response.headers);
      if (response.ok) return {
        ok: true as const,
        mode: "real" as const,
        status: response.status,
        payload: lastPayload,
        rateLimit: lastRateLimit,
        requestId: response.headers.get("x-request-id") || response.headers.get("request-id"),
      };
      const retryable = method === "GET" && (response.status === 429 || response.status >= 500);
      const fallbackError = `holded_http_${response.status}`;
      if (!retryable || attempt === retries) return {
        ok: false as const,
        mode: "real" as const,
        status: response.status,
        error: fallbackError,
        detail: errorDetail(lastPayload, fallbackError),
        payload: lastPayload,
        rateLimit: lastRateLimit,
      };
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      const delay = retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : Math.min(750 * 2 ** attempt + Math.floor(Math.random() * 250), 8_000);
      await sleep(delay);
    } catch (error) {
      clearTimeout(timer);
      if (attempt === retries) return {
        ok: false as const,
        mode: "real" as const,
        status: lastStatus || 504,
        error: error instanceof Error && error.name === "AbortError" ? "holded_timeout" : "holded_network_error",
        detail: error instanceof Error ? error.message : "No se pudo contactar con Holded.",
        payload: lastPayload,
        rateLimit: lastRateLimit,
      };
      await sleep(Math.min(750 * 2 ** attempt + Math.floor(Math.random() * 250), 8_000));
    }
  }
  return { ok: false as const, mode: "real" as const, status: lastStatus || 500, error: "holded_request_failed", detail: "No se pudo completar la petición a Holded.", payload: lastPayload, rateLimit: lastRateLimit };
}

export async function testHoldedModules(organizationId: string) {
  const configuration = await holdedConfiguration(organizationId);
  const entries = await Promise.all((Object.entries(configuration.endpoints) as Array<[HoldedModule, string]>).map(async ([module, path]) => {
    const separator = path.includes("?") ? "&" : "?";
    const result = await holdedRequest({ organizationId, path: `${path}${separator}limit=1`, retries: 0, timeoutMs: 12_000 });
    return [module, {
      ok: result.ok,
      status: result.status,
      error: result.ok ? null : result.error,
      detail: result.ok ? null : result.detail,
      path,
      readScope: holdedModuleScopes[module].read,
      writeScope: holdedModuleScopes[module].write,
      permissionGranted: result.ok,
      authenticated: result.ok || result.status === 403,
      rateLimit: result.rateLimit,
    }] as const;
  }));
  const modules = Object.fromEntries(entries) as Record<HoldedModule, {
    ok: boolean;
    status: number;
    error: string | null;
    detail: string | null;
    path: string;
    readScope: string;
    writeScope: string;
    permissionGranted: boolean;
    authenticated: boolean;
    rateLimit: ReturnType<typeof rateLimitHeaders> | null;
  }>;
  const authenticated = Object.values(modules).some((item) => item.authenticated);
  const availableModules = Object.entries(modules).filter(([, item]) => item.ok).map(([module]) => module);
  const missingReadScopes = Object.values(modules).filter((item) => item.status === 403).map((item) => item.readScope);
  const invalidKey = Object.values(modules).every((item) => item.status === 401);
  return {
    ok: authenticated && availableModules.length > 0,
    authenticated,
    invalidKey,
    apiVersion: configuration.apiVersion,
    authMode: configuration.authMode,
    baseUrl: configuration.baseUrl,
    availableModules,
    missingReadScopes,
    requiredWriteScopes: Object.values(holdedModuleScopes).map((scope) => scope.write),
    modules,
  };
}

function cleanAddress(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const address = input as Record<string, unknown>;
  const output = {
    address: String(address.address || address.line1 || "").trim() || undefined,
    city: String(address.city || "").trim() || undefined,
    postal_code: String(address.postal_code || address.zip || "").trim() || undefined,
    province: String(address.province || address.state || "").trim() || undefined,
    country: String(address.country || "").trim() || undefined,
    country_code: String(address.country_code || "").trim().toUpperCase() || undefined,
    info: String(address.info || address.line2 || "").trim() || undefined,
  };
  return Object.values(output).some(Boolean) ? output : undefined;
}

export function buildHoldedContactPayload(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  billingAddress?: unknown;
  type?: "client" | "supplier" | "lead";
  isPerson?: boolean;
  countryCode?: string | null;
}) {
  const billAddress = cleanAddress(input.billingAddress);
  if (billAddress && input.countryCode && !billAddress.country_code) billAddress.country_code = input.countryCode.toUpperCase();
  return {
    name: input.name,
    vat_number: input.taxId || undefined,
    is_person: input.isPerson ?? input.type !== "supplier",
    email: input.email || undefined,
    phone: input.phone || undefined,
    mobile: input.phone || undefined,
    type: input.type || "client",
    bill_address: billAddress,
  };
}

export function buildHoldedDocumentPayload(input: {
  contactId: string;
  contactName?: string | null;
  description: string;
  amount: number;
  currency?: string;
  notes?: string;
  date?: string;
  dueDate?: string;
}) {
  const date = (input.date || new Date().toISOString()).slice(0, 10);
  return {
    contact_id: input.contactId,
    contact_name: input.contactName || undefined,
    description: input.description,
    date,
    due_date: input.dueDate ? input.dueDate.slice(0, 10) : undefined,
    notes: input.notes || undefined,
    language: "es",
    currency: input.currency || "EUR",
    items: [{ name: input.description, type: "service", description: input.description, units: 1, price: Number(input.amount.toFixed(2)), discount: 0 }],
  };
}

export function buildHoldedPurchasePayload(input: {
  contactId: string;
  contactName?: string | null;
  description: string;
  amount: number;
  currency?: string;
  notes?: string;
  date?: string;
  dueDate?: string;
  number?: string | null;
}) {
  return {
    ...buildHoldedDocumentPayload(input),
    number: input.number || undefined,
  };
}

export function buildHoldedPaymentPayload(input: {
  contactId?: string | null;
  amount: number;
  date?: string;
  description: string;
  direction?: "payment" | "collection";
}) {
  return {
    type: input.direction || "collection",
    amount: Number(input.amount).toFixed(2),
    date: (input.date || new Date().toISOString()).slice(0, 10),
    contact_id: input.contactId || undefined,
    description: input.description,
  };
}
