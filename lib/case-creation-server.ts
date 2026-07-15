import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import type { RepositoryResult } from "@/lib/server-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const supportedCurrencies = ["EUR", "USD", "GBP", "CRC", "MXN"] as const;
export type SupportedCurrency = (typeof supportedCurrencies)[number];

function normalizeCurrency(value: unknown, fallback: SupportedCurrency = "EUR"): SupportedCurrency {
  const candidate = String(value || "").trim().toUpperCase();
  return supportedCurrencies.includes(candidate as SupportedCurrency) ? candidate as SupportedCurrency : fallback;
}

function randomCaseCode() {
  return `EXP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

export async function createConfiguredCase(input: {
  organizationId: string;
  clientId: string;
  destination: string;
  title?: string | null;
  tripStart?: string | null;
  tripEnd?: string | null;
  finalNotes?: string | null;
  requestedCurrency?: unknown;
}): Promise<RepositoryResult<unknown>> {
  const [settings, supabase] = await Promise.all([
    loadEffectiveSettings(input.organizationId),
    Promise.resolve(getSupabaseAdminClient()),
  ]);
  const defaultCurrency = normalizeCurrency(settings.string("money.currency", "EUR"));
  const currency = normalizeCurrency(input.requestedCurrency, defaultCurrency);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const payload = {
      organization_id: input.organizationId,
      case_code: randomCaseCode(),
      client_id: input.clientId,
      title: String(input.title || input.destination).trim(),
      destination: input.destination,
      trip_start: input.tripStart || null,
      trip_end: input.tripEnd || null,
      status: "new_lead",
      next_action: "Cualificar solicitud",
      blocker: null,
      final_notes: input.finalNotes || null,
      currency,
    };
    const { data, error } = await supabase
      .from("cases")
      .insert(payload)
      .select("*, clients(display_name,email,phone,holded_contact_id)")
      .single();
    if (!error) return { ok: true, mode: "supabase", data };
    if (!String(error.message || "").toLowerCase().includes("case_code")) return { ok: false, mode: "supabase", error: error.message };
  }

  return { ok: false, mode: "supabase", error: "case_code_generation_failed" };
}
