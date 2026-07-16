import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type CommunicationCadenceSettings = {
  enabled: boolean;
  preferredChannel: "whatsapp_then_email" | "email_then_whatsapp" | "email_only" | "whatsapp_only";
  proposalFollowupDays: number;
  contractFollowupDays: number;
  paymentFollowupDays: number;
  supplierInvoiceFollowupDays: number;
  supplierConfirmationDays: number;
  repeatDays: number;
  maxSteps: number;
};

const definitions = [
  { key: "communications.enabled", field: "enabled", label: "Activar seguimientos", description: "Genera acciones y tareas de seguimiento sin enviar mensajes automáticamente.", type: "boolean", defaultValue: true },
  { key: "communications.preferred_channel", field: "preferredChannel", label: "Canal preferido", description: "Canal utilizado cuando el contacto dispone de email y teléfono.", type: "select", defaultValue: "whatsapp_then_email" },
  { key: "communications.proposal_followup_days", field: "proposalFollowupDays", label: "Seguimiento de presupuesto (días)", description: "Días desde el último envío antes de preparar el seguimiento.", type: "number", defaultValue: 3 },
  { key: "communications.contract_followup_days", field: "contractFollowupDays", label: "Recordatorio de firma (días)", description: "Días desde el envío del contrato antes de preparar el recordatorio.", type: "number", defaultValue: 2 },
  { key: "communications.payment_followup_days", field: "paymentFollowupDays", label: "Recordatorio de pago (días)", description: "Días desde la firma antes de preparar un recordatorio si queda saldo pendiente.", type: "number", defaultValue: 3 },
  { key: "communications.supplier_invoice_followup_days", field: "supplierInvoiceFollowupDays", label: "Reclamar factura proveedor (días)", description: "Días desde la solicitud antes de preparar una reclamación de factura.", type: "number", defaultValue: 5 },
  { key: "communications.supplier_confirmation_days", field: "supplierConfirmationDays", label: "Confirmar proveedor (días)", description: "Antelación para preparar la confirmación de un servicio pendiente.", type: "number", defaultValue: 14 },
  { key: "communications.repeat_days", field: "repeatDays", label: "Repetición sin respuesta (días)", description: "Días tras registrar un envío antes de preparar el siguiente paso de la cadencia.", type: "number", defaultValue: 3 },
  { key: "communications.max_steps", field: "maxSteps", label: "Máximo de intentos", description: "Número máximo de comunicaciones preparadas por seguimiento.", type: "number", defaultValue: 3 },
] as const;

export const communicationCadenceDefinitions = definitions;

function unwrap(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) return (value as { value?: unknown }).value;
  return value;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export async function loadCommunicationCadenceSettings(organizationId: string): Promise<CommunicationCadenceSettings> {
  const { data, error } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .select("key,value")
    .eq("organization_id", organizationId)
    .in("key", definitions.map((item) => item.key));
  if (error) throw new Error(error.message);
  const values = new Map((data || []).map((row) => [String(row.key), unwrap(row.value)]));
  const preferred = String(values.get("communications.preferred_channel") || "whatsapp_then_email");
  const preferredChannel = ["whatsapp_then_email", "email_then_whatsapp", "email_only", "whatsapp_only"].includes(preferred)
    ? preferred as CommunicationCadenceSettings["preferredChannel"]
    : "whatsapp_then_email";

  return {
    enabled: typeof values.get("communications.enabled") === "boolean" ? Boolean(values.get("communications.enabled")) : true,
    preferredChannel,
    proposalFollowupDays: clampInteger(values.get("communications.proposal_followup_days"), 3, 1, 60),
    contractFollowupDays: clampInteger(values.get("communications.contract_followup_days"), 2, 1, 60),
    paymentFollowupDays: clampInteger(values.get("communications.payment_followup_days"), 3, 1, 90),
    supplierInvoiceFollowupDays: clampInteger(values.get("communications.supplier_invoice_followup_days"), 5, 1, 90),
    supplierConfirmationDays: clampInteger(values.get("communications.supplier_confirmation_days"), 14, 1, 120),
    repeatDays: clampInteger(values.get("communications.repeat_days"), 3, 1, 30),
    maxSteps: clampInteger(values.get("communications.max_steps"), 3, 1, 8),
  };
}

export async function updateCommunicationCadenceSettings(input: {
  organizationId: string;
  actorId: string;
  settings: Partial<CommunicationCadenceSettings>;
}) {
  const current = await loadCommunicationCadenceSettings(input.organizationId);
  const next: CommunicationCadenceSettings = {
    enabled: input.settings.enabled === undefined ? current.enabled : Boolean(input.settings.enabled),
    preferredChannel: input.settings.preferredChannel && ["whatsapp_then_email", "email_then_whatsapp", "email_only", "whatsapp_only"].includes(input.settings.preferredChannel)
      ? input.settings.preferredChannel
      : current.preferredChannel,
    proposalFollowupDays: clampInteger(input.settings.proposalFollowupDays, current.proposalFollowupDays, 1, 60),
    contractFollowupDays: clampInteger(input.settings.contractFollowupDays, current.contractFollowupDays, 1, 60),
    paymentFollowupDays: clampInteger(input.settings.paymentFollowupDays, current.paymentFollowupDays, 1, 90),
    supplierInvoiceFollowupDays: clampInteger(input.settings.supplierInvoiceFollowupDays, current.supplierInvoiceFollowupDays, 1, 90),
    supplierConfirmationDays: clampInteger(input.settings.supplierConfirmationDays, current.supplierConfirmationDays, 1, 120),
    repeatDays: clampInteger(input.settings.repeatDays, current.repeatDays, 1, 30),
    maxSteps: clampInteger(input.settings.maxSteps, current.maxSteps, 1, 8),
  };

  const byField = new Map<string, unknown>(Object.entries(next));
  const rows = definitions.map((definition) => ({
    organization_id: input.organizationId,
    module: "communications",
    key: definition.key,
    value: byField.get(definition.field),
    default_value: definition.defaultValue,
    label: definition.label,
    description: definition.description,
    value_type: definition.type,
    scope: "global",
    editable: true,
    requires_recalculation: false,
    affected_modules: ["communications", "tasks", "today"],
    updated_by: input.actorId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await getSupabaseAdminClient()
    .from("routsify_settings")
    .upsert(rows, { onConflict: "organization_id,key" });
  if (error) throw new Error(error.message);
  return next;
}
