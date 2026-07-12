import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type HoldedRequest = {
  organizationId?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
};

export const holdedModuleDefaults = {
  contacts: "/invoicing/v1/contacts",
  estimates: "/invoicing/v1/documents/estimate",
  proformas: "/invoicing/v1/documents/proform",
  invoices: "/invoicing/v1/documents/invoice",
  purchases: "/invoicing/v1/documents/purchase",
  payments: "/invoicing/v1/payments",
} as const;

export type HoldedModule = keyof typeof holdedModuleDefaults;

function settingText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "value" in value) return String((value as { value?: unknown }).value || "").trim();
  return "";
}

export async function holdedConfiguration(organizationId: string) {
  const keys = ["integrations.holded.base_url", ...Object.keys(holdedModuleDefaults).map((module) => `integrations.holded.endpoint.${module}`)];
  const { data } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value")
    .eq("organization_id", organizationId)
    .in("key", keys);
  const values = new Map((data || []).map((row) => [String(row.key), settingText(row.value)]));
  const baseUrl = values.get("integrations.holded.base_url") || process.env.HOLDED_API_BASE_URL || "https://api.holded.com/api";
  const endpoints = Object.fromEntries(Object.entries(holdedModuleDefaults).map(([module, fallback]) => [module, values.get(`integrations.holded.endpoint.${module}`) || fallback])) as Record<HoldedModule, string>;
  return { baseUrl: baseUrl.replace(/\/$/, ""), endpoints };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function holdedRequest(input: HoldedRequest) {
  const organizationId = input.organizationId || process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
  if (!organizationId) return { ok: false as const, mode: "unconfigured" as const, status: 503, error: "organization_not_configured", payload: null };
  const apiKey = await getOrganizationSecret(organizationId, "holded_api_key");
  if (!apiKey) return { ok: false as const, mode: "unconfigured" as const, status: 503, error: "holded_api_key_not_configured", payload: null };
  const { baseUrl } = await holdedConfiguration(organizationId);
  const timeoutMs = Math.min(Math.max(input.timeoutMs || 15_000, 2_000), 30_000);
  const retries = Math.min(Math.max(input.retries ?? 2, 0), 4);
  let lastStatus = 0;
  let lastPayload: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`, {
        method: input.method || "GET",
        headers: { "Content-Type": "application/json", key: apiKey, "User-Agent": "Routsify-Software/1.0" },
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      const text = await response.text();
      try { lastPayload = text ? JSON.parse(text) : null; } catch { lastPayload = text; }
      lastStatus = response.status;
      if (response.ok) return { ok: true as const, mode: "real" as const, status: response.status, payload: lastPayload };
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === retries) return { ok: false as const, mode: "real" as const, status: response.status, error: `holded_http_${response.status}`, payload: lastPayload };
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : Math.min(750 * 2 ** attempt, 8_000));
    } catch (error) {
      clearTimeout(timer);
      if (attempt === retries) return { ok: false as const, mode: "real" as const, status: lastStatus || 504, error: error instanceof Error && error.name === "AbortError" ? "holded_timeout" : "holded_network_error", payload: lastPayload };
      await sleep(Math.min(750 * 2 ** attempt, 8_000));
    }
  }
  return { ok: false as const, mode: "real" as const, status: lastStatus || 500, error: "holded_request_failed", payload: lastPayload };
}

export async function testHoldedModules(organizationId: string) {
  const { endpoints } = await holdedConfiguration(organizationId);
  const entries = await Promise.all(Object.entries(endpoints).map(async ([module, path]) => {
    const separator = path.includes("?") ? "&" : "?";
    const result = await holdedRequest({ organizationId, path: `${path}${separator}limit=1`, retries: 0, timeoutMs: 10_000 });
    return [module, { ok: result.ok, status: result.status, error: result.ok ? null : result.error, path }] as const;
  }));
  const modules = Object.fromEntries(entries) as Record<HoldedModule, { ok: boolean; status: number; error: string | null; path: string }>;
  return { ok: Object.values(modules).some((item) => item.ok), modules };
}

export function buildHoldedContactPayload(input: { name: string; email?: string | null; phone?: string | null; taxId?: string | null; billingAddress?: unknown }) {
  const address = input.billingAddress && typeof input.billingAddress === "object" ? input.billingAddress as Record<string, unknown> : null;
  return {
    name: input.name,
    email: input.email || undefined,
    phone: input.phone || undefined,
    vatnumber: input.taxId || undefined,
    billAddress: address ? String(address.address || address.line1 || "") || undefined : typeof input.billingAddress === "string" ? input.billingAddress : undefined,
    billCity: address ? String(address.city || "") || undefined : undefined,
    billPostalCode: address ? String(address.postal_code || address.zip || "") || undefined : undefined,
    billCountry: address ? String(address.country || "") || undefined : undefined,
  };
}

export function buildHoldedDocumentPayload(input: { contactId?: string | null; description: string; amount: number; currency?: string; notes?: string; date?: string; dueDate?: string }) {
  return {
    contactId: input.contactId || undefined,
    desc: input.description,
    date: input.date || undefined,
    dueDate: input.dueDate || undefined,
    currency: input.currency || "EUR",
    notes: input.notes || undefined,
    items: [{ name: input.description, units: 1, subtotal: Number(input.amount.toFixed(2)), tax: 0 }],
  };
}
