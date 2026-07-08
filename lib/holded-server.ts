type HoldedRequest = {
  method?: "GET" | "POST" | "PUT";
  path: string;
  body?: Record<string, unknown>;
};

export function hasHoldedEnv() {
  return Boolean(process.env.HOLDED_API_KEY);
}

export function holdedBaseUrl() {
  return process.env.HOLDED_API_BASE_URL || "https://api.holded.com/api";
}

export async function holdedRequest(input: HoldedRequest) {
  const apiKey = process.env.HOLDED_API_KEY;
  if (!apiKey) {
    return { ok: true, mode: "demo" as const, skipped: true, reason: "HOLDED_API_KEY not configured" };
  }

  const response = await fetch(`${holdedBaseUrl()}${input.path}`, {
    method: input.method || "GET",
    headers: {
      "Content-Type": "application/json",
      key: apiKey,
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    return { ok: false, mode: "real" as const, status: response.status, payload };
  }

  return { ok: true, mode: "real" as const, status: response.status, payload };
}

export function buildHoldedContactPayload(input: { name: string; email?: string | null; phone?: string | null; taxId?: string | null; billingAddress?: unknown }) {
  return {
    name: input.name,
    email: input.email || undefined,
    phone: input.phone || undefined,
    vatnumber: input.taxId || undefined,
    billAddress: typeof input.billingAddress === "string" ? input.billingAddress : undefined,
  };
}

export function buildHoldedDocumentPayload(input: { contactId: string; description: string; amount: number; currency?: string }) {
  return {
    contactId: input.contactId,
    desc: input.description,
    currency: input.currency || "EUR",
    items: [{ name: input.description, units: 1, subtotal: input.amount, tax: 0 }],
  };
}
