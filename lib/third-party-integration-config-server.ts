import { getSupabaseAdminClient } from "@/lib/supabase-admin";

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
} as const;

function valueOf(row: { value?: unknown } | undefined, fallback: unknown) {
  if (!row || row.value === undefined || row.value === null) return fallback;
  return row.value;
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
  };

  if (next.email.enabled && (!next.email.smtpHost || !next.email.fromAddress)) throw new Error("email_host_and_from_required");
  if (next.email.smtpPort < 1 || next.email.smtpPort > 65535) throw new Error("invalid_smtp_port");
  if (next.email.fromAddress && !/^\S+@\S+\.\S+$/.test(next.email.fromAddress)) throw new Error("invalid_from_address");
  if (next.email.replyTo && !/^\S+@\S+\.\S+$/.test(next.email.replyTo)) throw new Error("invalid_reply_to");
  if (next.whatsapp.enabled && (!next.whatsapp.graphVersion || !next.whatsapp.phoneNumberId)) throw new Error("whatsapp_version_and_phone_id_required");
  if (next.whatsapp.graphVersion && !/^v\d+\.\d+$/.test(next.whatsapp.graphVersion)) throw new Error("invalid_graph_version");
  if (next.whatsapp.phoneNumberId && !/^\d+$/.test(next.whatsapp.phoneNumberId)) throw new Error("invalid_phone_number_id");
  if (next.whatsapp.businessAccountId && !/^\d+$/.test(next.whatsapp.businessAccountId)) throw new Error("invalid_business_account_id");

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
    affected_modules: ["communications", "integrations"],
    updated_by: input.actorId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await getSupabaseAdminClient().from("routsify_settings").upsert(rows, { onConflict: "organization_id,key" });
  if (error) throw new Error(error.message);
  return next;
}
