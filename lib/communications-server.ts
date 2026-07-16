import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type CommunicationChannel = "email" | "whatsapp";
export type CommunicationStatus = "planned" | "prepared" | "sent" | "answered" | "cancelled";

export type CommunicationTemplate = {
  id: string;
  key: string;
  name: string;
  audience: "client" | "supplier";
  channel: CommunicationChannel;
  subject_template: string | null;
  body_template: string;
  active: boolean;
  system_template: boolean;
  updated_at: string;
};

export type CommunicationFollowup = {
  id: string;
  case_id: string | null;
  client_id: string | null;
  supplier_id: string | null;
  proposal_id: string | null;
  contract_id: string | null;
  purchase_id: string | null;
  task_id: string | null;
  kind: string;
  channel: CommunicationChannel;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  subject: string | null;
  body: string;
  status: CommunicationStatus;
  due_at: string;
  sent_at: string | null;
  answered_at: string | null;
  cancelled_at: string | null;
  thread_key: string;
  sequence_step: number;
  next_followup_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type Row = Record<string, unknown>;
type DefaultTemplate = Omit<CommunicationTemplate, "id" | "updated_at">;

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: "fillout_reminder",
    name: "Recordatorio de formulario",
    audience: "client",
    channel: "whatsapp",
    subject_template: null,
    body_template: "Hola {{client_name}} 😊 Para poder preparar bien nuestra llamada, necesitamos que completes este formulario: {{fillout_url}}. Muchas gracias.",
    active: true,
    system_template: true,
  },
  {
    key: "fillout_reminder",
    name: "Recordatorio de formulario",
    audience: "client",
    channel: "email",
    subject_template: "Formulario pendiente para preparar tu viaje",
    body_template: "Hola {{client_name}},\n\nPara poder preparar bien nuestra llamada, necesitamos que completes este formulario: {{fillout_url}}\n\nMuchas gracias.\nEquipo Routsify",
    active: true,
    system_template: true,
  },
  {
    key: "proposal_followup",
    name: "Seguimiento de presupuesto",
    audience: "client",
    channel: "whatsapp",
    subject_template: null,
    body_template: "Hola {{client_name}} 😊 Queríamos saber si has podido revisar la propuesta para {{destination}}. Estamos pendientes por si quieres que ajustemos cualquier detalle.",
    active: true,
    system_template: true,
  },
  {
    key: "proposal_followup",
    name: "Seguimiento de presupuesto",
    audience: "client",
    channel: "email",
    subject_template: "Seguimiento de tu propuesta de viaje a {{destination}}",
    body_template: "Hola {{client_name}},\n\nQueríamos saber si has podido revisar la propuesta que te enviamos para {{destination}}. Estamos pendientes por si quieres que ajustemos cualquier detalle.\n\nUn saludo,\nEquipo Routsify",
    active: true,
    system_template: true,
  },
  {
    key: "contract_reminder",
    name: "Recordatorio de firma",
    audience: "client",
    channel: "whatsapp",
    subject_template: null,
    body_template: "Hola {{client_name}} 😊 Te recordamos que está pendiente la firma del contrato del expediente {{case_code}}. Cuando puedas, revísalo para que podamos continuar con las reservas.",
    active: true,
    system_template: true,
  },
  {
    key: "contract_reminder",
    name: "Recordatorio de firma",
    audience: "client",
    channel: "email",
    subject_template: "Firma pendiente · {{case_code}}",
    body_template: "Hola {{client_name}},\n\nTe recordamos que está pendiente la firma del contrato del expediente {{case_code}}. Cuando puedas, revísalo para que podamos continuar con las reservas.\n\nUn saludo,\nEquipo Routsify",
    active: true,
    system_template: true,
  },
  {
    key: "payment_reminder",
    name: "Recordatorio de pago",
    audience: "client",
    channel: "whatsapp",
    subject_template: null,
    body_template: "Hola {{client_name}} 😊 Te recordamos que quedan {{pending_amount}} pendientes del expediente {{case_code}}. Avísanos cuando hayas podido realizar el pago o si necesitas que revisemos cualquier detalle.",
    active: true,
    system_template: true,
  },
  {
    key: "payment_reminder",
    name: "Recordatorio de pago",
    audience: "client",
    channel: "email",
    subject_template: "Pago pendiente · {{case_code}}",
    body_template: "Hola {{client_name}},\n\nTe recordamos que quedan {{pending_amount}} pendientes del expediente {{case_code}}. Avísanos cuando hayas podido realizar el pago o si necesitas que revisemos cualquier detalle.\n\nUn saludo,\nEquipo Routsify",
    active: true,
    system_template: true,
  },
  {
    key: "supplier_confirmation",
    name: "Confirmación de servicio",
    audience: "supplier",
    channel: "whatsapp",
    subject_template: null,
    body_template: "Hola {{supplier_name}}, necesitamos confirmar el servicio {{service}} del expediente {{case_code}}, con viaje previsto para {{trip_start}}. ¿Podéis confirmarnos disponibilidad y condiciones? Gracias.",
    active: true,
    system_template: true,
  },
  {
    key: "supplier_confirmation",
    name: "Confirmación de servicio",
    audience: "supplier",
    channel: "email",
    subject_template: "Confirmación de servicio · {{case_code}}",
    body_template: "Hola {{supplier_name}},\n\nNecesitamos confirmar el servicio {{service}} del expediente {{case_code}}, con viaje previsto para {{trip_start}}. ¿Podéis confirmarnos disponibilidad y condiciones?\n\nGracias,\nEquipo Routsify",
    active: true,
    system_template: true,
  },
  {
    key: "supplier_invoice_request",
    name: "Solicitud de factura",
    audience: "supplier",
    channel: "whatsapp",
    subject_template: null,
    body_template: "Hola {{supplier_name}}, seguimos pendientes de la factura correspondiente a {{service}} del expediente {{case_code}}. ¿Podéis enviárnosla, por favor? Gracias.",
    active: true,
    system_template: true,
  },
  {
    key: "supplier_invoice_request",
    name: "Solicitud de factura",
    audience: "supplier",
    channel: "email",
    subject_template: "Factura pendiente · {{case_code}} · {{service}}",
    body_template: "Hola {{supplier_name}},\n\nSeguimos pendientes de la factura correspondiente a {{service}} del expediente {{case_code}}. ¿Podéis enviárnosla, por favor?\n\nGracias,\nEquipo Routsify",
    active: true,
    system_template: true,
  },
];

const MANAGED_KINDS = new Set([
  "fillout_reminder",
  "proposal_followup",
  "contract_reminder",
  "payment_reminder",
  "supplier_confirmation",
  "supplier_invoice_request",
]);

const text = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const timestamp = (value: unknown) => {
  const parsed = value ? new Date(String(value)).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const ageDays = (value: unknown, nowMs: number) => {
  const valueMs = timestamp(value);
  return valueMs ? Math.max(0, Math.floor((nowMs - valueMs) / 86_400_000)) : 0;
};
const normalizePhone = (value: unknown) => text(value).replace(/\D/g, "");

function mapById(rows: Row[]) {
  return new Map(rows.map((row) => [text(row.id), row]));
}

function groupByCase(rows: Row[]) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const caseId = text(row.case_id);
    if (!caseId) continue;
    grouped.set(caseId, [...(grouped.get(caseId) || []), row]);
  }
  return grouped;
}

function renderTemplate(template: string | null | undefined, variables: Record<string, unknown>) {
  if (!template) return "";
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => text(variables[key]));
}

function preferredChannel(preference: string, email: string, phone: string): CommunicationChannel | null {
  if (preference === "email_only") return email ? "email" : null;
  if (preference === "whatsapp_only") return phone ? "whatsapp" : null;
  if (preference === "email_then_whatsapp") return email ? "email" : phone ? "whatsapp" : null;
  return phone ? "whatsapp" : email ? "email" : null;
}

function dueIso(anchor: unknown, delayDays: number) {
  const anchorMs = timestamp(anchor) || Date.now();
  return new Date(anchorMs + Math.max(0, delayDays) * 86_400_000).toISOString();
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency || "EUR" }).format(value);
  } catch {
    return `${value.toLocaleString("es-ES")} ${currency || "EUR"}`;
  }
}

export async function ensureDefaultCommunicationTemplates(organizationId: string) {
  const db = getSupabaseAdminClient();
  const { data: existing, error } = await db
    .from("communication_templates")
    .select("key,channel")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  const existingKeys = new Set((existing || []).map((row) => `${row.key}:${row.channel}`));
  const missing = DEFAULT_TEMPLATES
    .filter((template) => !existingKeys.has(`${template.key}:${template.channel}`))
    .map((template) => ({ ...template, organization_id: organizationId }));

  if (missing.length) {
    const { error: insertError } = await db.from("communication_templates").insert(missing);
    if (insertError && insertError.code !== "23505") throw new Error(insertError.message);
  }
}

async function createOrRefreshTask(input: {
  organizationId: string;
  caseId?: string | null;
  clientId?: string | null;
  title: string;
  dueAt: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}) {
  const db = getSupabaseAdminClient();
  const { data: existing, error: lookupError } = await db
    .from("tasks")
    .select("id,status")
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing && ["done", "cancelled"].includes(text(existing.status))) return String(existing.id);

  const row = {
    organization_id: input.organizationId,
    case_id: input.caseId || null,
    client_id: input.clientId || null,
    title: input.title,
    status: existing?.status || "pending",
    priority: "high",
    due_at: input.dueAt,
    idempotency_key: input.idempotencyKey,
    payload: input.payload,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await db.from("tasks").update(row).eq("id", existing.id).eq("organization_id", input.organizationId);
    if (error) throw new Error(error.message);
    return String(existing.id);
  }

  const { data, error } = await db.from("tasks").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

type ThreadInput = {
  organizationId: string;
  templates: Map<string, CommunicationTemplate>;
  existingByThread: Map<string, CommunicationFollowup[]>;
  threadKey: string;
  kind: string;
  templateKey: string;
  dueAt: string;
  maxSteps: number;
  repeatDays: number;
  channelPreference: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  variables: Record<string, unknown>;
  caseId?: string | null;
  clientId?: string | null;
  supplierId?: string | null;
  proposalId?: string | null;
  contractId?: string | null;
  purchaseId?: string | null;
  metadata?: Record<string, unknown>;
};

async function planThread(input: ThreadInput) {
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = (input.existingByThread.get(input.threadKey) || []).sort((a, b) => b.sequence_step - a.sequence_step);
  const latest = rows[0];
  if (latest && ["answered", "cancelled"].includes(latest.status)) return { changed: false, id: latest.id, terminal: true };

  let step = 1;
  if (latest?.status === "sent") {
    const nextMs = timestamp(latest.next_followup_at);
    if (!nextMs || nextMs > Date.now() || latest.sequence_step >= input.maxSteps) return { changed: false, id: latest.id, terminal: false };
    step = latest.sequence_step + 1;
  } else if (latest) {
    step = latest.sequence_step;
  }

  const channel = preferredChannel(input.channelPreference, input.recipientEmail, input.recipientPhone);
  if (!channel) return { changed: false, id: latest?.id || null, terminal: false, reason: "recipient_channel_missing" };
  const template = input.templates.get(`${input.templateKey}:${channel}`);
  if (!template?.active) return { changed: false, id: latest?.id || null, terminal: false, reason: "template_inactive" };

  const subject = renderTemplate(template.subject_template, input.variables) || null;
  const body = renderTemplate(template.body_template, input.variables);
  const idempotencyKey = `${input.threadKey}:step:${step}`;
  const baseRow = {
    organization_id: input.organizationId,
    case_id: input.caseId || null,
    client_id: input.clientId || null,
    supplier_id: input.supplierId || null,
    proposal_id: input.proposalId || null,
    contract_id: input.contractId || null,
    purchase_id: input.purchaseId || null,
    template_id: template.id,
    kind: input.kind,
    channel,
    recipient_name: input.recipientName || null,
    recipient_email: input.recipientEmail || null,
    recipient_phone: normalizePhone(input.recipientPhone) || null,
    subject,
    body,
    due_at: input.dueAt,
    thread_key: input.threadKey,
    sequence_step: step,
    idempotency_key: idempotencyKey,
    metadata: input.metadata || {},
    updated_at: now,
  };

  let followupId = latest && latest.sequence_step === step && ["planned", "prepared"].includes(latest.status) ? latest.id : null;
  if (followupId) {
    const { error } = await db
      .from("communication_followups")
      .update(baseRow)
      .eq("id", followupId)
      .eq("organization_id", input.organizationId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db
      .from("communication_followups")
      .insert({ ...baseRow, status: "planned" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    followupId = String(data.id);
  }

  const taskId = await createOrRefreshTask({
    organizationId: input.organizationId,
    caseId: input.caseId,
    clientId: input.clientId,
    title: `Enviar seguimiento · ${template.name}`,
    dueAt: input.dueAt,
    idempotencyKey: `communication_task:${idempotencyKey}`,
    payload: {
      action_type: "communication_followup",
      communication_followup_id: followupId,
      kind: input.kind,
      channel,
      recipient_name: input.recipientName || null,
      recipient_email: input.recipientEmail || null,
      recipient_phone: normalizePhone(input.recipientPhone) || null,
      suggested_subject: subject,
      suggested_message: body,
      sequence_step: step,
    },
  });

  const { error: taskLinkError } = await db
    .from("communication_followups")
    .update({ task_id: taskId, updated_at: now })
    .eq("id", followupId)
    .eq("organization_id", input.organizationId);
  if (taskLinkError) throw new Error(taskLinkError.message);

  return { changed: true, id: followupId, terminal: false };
}

export async function syncCommunicationFollowups(organizationId: string) {
  await ensureDefaultCommunicationTemplates(organizationId);
  const db = getSupabaseAdminClient();
  const settings = await loadEffectiveSettings(organizationId);
  if (!settings.boolean("communications.enabled", true)) return { enabled: false, planned: 0, cancelled: 0 };

  const nowMs = Date.now();
  const proposalDays = Math.max(1, settings.number("communications.proposal_followup_days", 3));
  const contractDays = Math.max(1, settings.number("communications.contract_followup_days", 2));
  const paymentDays = Math.max(1, settings.number("communications.payment_followup_days", 3));
  const supplierInvoiceDays = Math.max(1, settings.number("communications.supplier_invoice_followup_days", 5));
  const supplierConfirmationDays = Math.max(1, settings.number("communications.supplier_confirmation_days", 14));
  const repeatDays = Math.max(1, settings.number("communications.repeat_days", 3));
  const maxSteps = Math.min(8, Math.max(1, settings.number("communications.max_steps", 3)));
  const channelPreference = settings.string("communications.preferred_channel", "whatsapp_then_email");

  const [
    templatesResult,
    clientsResult,
    suppliersResult,
    casesResult,
    proposalsResult,
    contractsResult,
    paymentsResult,
    purchasesResult,
    tasksResult,
    existingResult,
  ] = await Promise.all([
    db.from("communication_templates").select("id,key,name,audience,channel,subject_template,body_template,active,system_template,updated_at").eq("organization_id", organizationId),
    db.from("clients").select("id,display_name,email,phone").eq("organization_id", organizationId).limit(1000),
    db.from("suppliers").select("id,name,email,phone,active").eq("organization_id", organizationId).eq("active", true).limit(1000),
    db.from("cases").select("id,client_id,case_code,title,status,destination,trip_start,accepted_value,currency").eq("organization_id", organizationId).neq("status", "closed").limit(1000),
    db.from("proposals").select("id,case_id,status,created_at,updated_at").eq("organization_id", organizationId).in("status", ["sent", "accepted", "rejected"]).limit(1000),
    db.from("contracts").select("id,case_id,status,external_url,created_at,updated_at").eq("organization_id", organizationId).limit(1000),
    db.from("payments").select("case_id,status,amount").eq("organization_id", organizationId).limit(2000),
    db.from("expected_purchases").select("id,case_id,supplier_id,status,service,supplier_name,due_date,requested_at,invoice_number,invoice_total,active,required,created_at,updated_at").eq("organization_id", organizationId).eq("active", true).limit(2000),
    db.from("tasks").select("id,case_id,client_id,title,status,due_at,payload").eq("organization_id", organizationId).in("status", ["pending", "in_progress"]).contains("payload", { action_type: "fillout_reminder" }).limit(500),
    db.from("communication_followups").select("id,case_id,client_id,supplier_id,proposal_id,contract_id,purchase_id,task_id,kind,channel,recipient_name,recipient_email,recipient_phone,subject,body,status,due_at,sent_at,answered_at,cancelled_at,thread_key,sequence_step,next_followup_at,metadata,created_at,updated_at").eq("organization_id", organizationId).order("sequence_step", { ascending: false }).limit(3000),
  ]);

  const firstError = [templatesResult.error, clientsResult.error, suppliersResult.error, casesResult.error, proposalsResult.error, contractsResult.error, paymentsResult.error, purchasesResult.error, tasksResult.error, existingResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const templates = new Map(((templatesResult.data || []) as CommunicationTemplate[]).map((row) => [`${row.key}:${row.channel}`, row]));
  const clients = mapById((clientsResult.data || []) as Row[]);
  const suppliers = mapById((suppliersResult.data || []) as Row[]);
  const cases = mapById((casesResult.data || []) as Row[]);
  const proposals = (proposalsResult.data || []) as Row[];
  const contracts = (contractsResult.data || []) as Row[];
  const payments = groupByCase((paymentsResult.data || []) as Row[]);
  const purchases = (purchasesResult.data || []) as Row[];
  const tasks = (tasksResult.data || []) as Row[];
  const existing = (existingResult.data || []) as CommunicationFollowup[];
  const existingByThread = new Map<string, CommunicationFollowup[]>();
  for (const row of existing) existingByThread.set(row.thread_key, [...(existingByThread.get(row.thread_key) || []), row]);
  const contractByCase = groupByCase(contracts);
  const activeThreads = new Set<string>();
  let planned = 0;

  const common = { organizationId, templates, existingByThread, maxSteps, repeatDays, channelPreference };

  for (const task of tasks) {
    const payload = (task.payload && typeof task.payload === "object" ? task.payload : {}) as Record<string, unknown>;
    const client = clients.get(text(task.client_id));
    const threadKey = `fillout_reminder:${text(task.id)}`;
    activeThreads.add(threadKey);
    const result = await planThread({
      ...common,
      threadKey,
      kind: "fillout_reminder",
      templateKey: "fillout_reminder",
      dueAt: text(task.due_at) || new Date().toISOString(),
      recipientName: text(client?.display_name),
      recipientEmail: text(payload.recipient_email || client?.email),
      recipientPhone: text(payload.recipient_phone || client?.phone),
      variables: { client_name: text(client?.display_name) || "", fillout_url: text(payload.fillout_url) },
      caseId: text(task.case_id) || null,
      clientId: text(task.client_id) || null,
      metadata: { source_task_id: task.id, source: "fillout_task" },
    });
    if (result.changed) planned += 1;
  }

  for (const proposal of proposals) {
    if (text(proposal.status) !== "sent" || ageDays(proposal.updated_at || proposal.created_at, nowMs) < proposalDays) continue;
    const relatedCase = cases.get(text(proposal.case_id));
    if (!relatedCase) continue;
    const client = clients.get(text(relatedCase.client_id));
    const threadKey = `proposal_followup:${text(proposal.id)}`;
    activeThreads.add(threadKey);
    const result = await planThread({
      ...common,
      threadKey,
      kind: "proposal_followup",
      templateKey: "proposal_followup",
      dueAt: dueIso(proposal.updated_at || proposal.created_at, proposalDays),
      recipientName: text(client?.display_name),
      recipientEmail: text(client?.email),
      recipientPhone: text(client?.phone),
      variables: { client_name: text(client?.display_name), destination: text(relatedCase.destination) || "tu viaje", case_code: text(relatedCase.case_code) },
      caseId: text(relatedCase.id),
      clientId: text(relatedCase.client_id),
      proposalId: text(proposal.id),
      metadata: { case_code: relatedCase.case_code, destination: relatedCase.destination },
    });
    if (result.changed) planned += 1;
  }

  for (const contract of contracts) {
    if (text(contract.status) !== "sent" || ageDays(contract.updated_at || contract.created_at, nowMs) < contractDays) continue;
    const relatedCase = cases.get(text(contract.case_id));
    if (!relatedCase) continue;
    const client = clients.get(text(relatedCase.client_id));
    const threadKey = `contract_reminder:${text(contract.id)}`;
    activeThreads.add(threadKey);
    const result = await planThread({
      ...common,
      threadKey,
      kind: "contract_reminder",
      templateKey: "contract_reminder",
      dueAt: dueIso(contract.updated_at || contract.created_at, contractDays),
      recipientName: text(client?.display_name),
      recipientEmail: text(client?.email),
      recipientPhone: text(client?.phone),
      variables: { client_name: text(client?.display_name), case_code: text(relatedCase.case_code), destination: text(relatedCase.destination), contract_url: text(contract.external_url) },
      caseId: text(relatedCase.id),
      clientId: text(relatedCase.client_id),
      contractId: text(contract.id),
      metadata: { case_code: relatedCase.case_code, destination: relatedCase.destination, contract_url: contract.external_url },
    });
    if (result.changed) planned += 1;
  }

  for (const relatedCase of cases.values()) {
    const caseId = text(relatedCase.id);
    const signedContract = (contractByCase.get(caseId) || []).find((row) => text(row.status) === "signed");
    if (!signedContract || ageDays(signedContract.updated_at || signedContract.created_at, nowMs) < paymentDays) continue;
    const acceptedValue = numberValue(relatedCase.accepted_value);
    const confirmed = (payments.get(caseId) || []).filter((row) => ["confirmed", "paid", "received"].includes(text(row.status))).reduce((sum, row) => sum + numberValue(row.amount), 0);
    const pending = Math.max(0, acceptedValue - confirmed);
    if (acceptedValue <= 0 || pending <= 0) continue;
    const client = clients.get(text(relatedCase.client_id));
    const threadKey = `payment_reminder:${caseId}`;
    activeThreads.add(threadKey);
    const currency = text(relatedCase.currency) || "EUR";
    const result = await planThread({
      ...common,
      threadKey,
      kind: "payment_reminder",
      templateKey: "payment_reminder",
      dueAt: dueIso(signedContract.updated_at || signedContract.created_at, paymentDays),
      recipientName: text(client?.display_name),
      recipientEmail: text(client?.email),
      recipientPhone: text(client?.phone),
      variables: { client_name: text(client?.display_name), case_code: text(relatedCase.case_code), pending_amount: formatMoney(pending, currency), destination: text(relatedCase.destination) },
      caseId,
      clientId: text(relatedCase.client_id),
      contractId: text(signedContract.id),
      metadata: { case_code: relatedCase.case_code, pending_amount: pending, currency },
    });
    if (result.changed) planned += 1;
  }

  for (const purchase of purchases) {
    const relatedCase = cases.get(text(purchase.case_id));
    const supplier = suppliers.get(text(purchase.supplier_id));
    if (!relatedCase || !supplier) continue;
    const baseVariables = {
      supplier_name: text(supplier.name) || text(purchase.supplier_name),
      service: text(purchase.service) || "el servicio contratado",
      case_code: text(relatedCase.case_code),
      destination: text(relatedCase.destination),
      trip_start: relatedCase.trip_start ? new Date(`${text(relatedCase.trip_start)}T12:00:00`).toLocaleDateString("es-ES") : "",
    };

    if (text(purchase.status) === "expected") {
      const dueMs = purchase.due_date ? new Date(`${text(purchase.due_date)}T12:00:00`).getTime() : null;
      const shouldConfirm = dueMs ? dueMs <= nowMs + supplierConfirmationDays * 86_400_000 : ageDays(purchase.updated_at || purchase.created_at, nowMs) >= supplierConfirmationDays;
      if (shouldConfirm) {
        const threadKey = `supplier_confirmation:${text(purchase.id)}`;
        activeThreads.add(threadKey);
        const result = await planThread({
          ...common,
          threadKey,
          kind: "supplier_confirmation",
          templateKey: "supplier_confirmation",
          dueAt: new Date().toISOString(),
          recipientName: text(supplier.name),
          recipientEmail: text(supplier.email),
          recipientPhone: text(supplier.phone),
          variables: baseVariables,
          caseId: text(relatedCase.id),
          clientId: text(relatedCase.client_id),
          supplierId: text(supplier.id),
          purchaseId: text(purchase.id),
          metadata: { case_code: relatedCase.case_code, service: purchase.service, supplier_name: supplier.name },
        });
        if (result.changed) planned += 1;
      }
    }

    const invoiceMissing = !text(purchase.invoice_number) && numberValue(purchase.invoice_total) <= 0;
    if (text(purchase.status) === "requested" && invoiceMissing && ageDays(purchase.requested_at || purchase.updated_at, nowMs) >= supplierInvoiceDays) {
      const threadKey = `supplier_invoice_request:${text(purchase.id)}`;
      activeThreads.add(threadKey);
      const result = await planThread({
        ...common,
        threadKey,
        kind: "supplier_invoice_request",
        templateKey: "supplier_invoice_request",
        dueAt: dueIso(purchase.requested_at || purchase.updated_at, supplierInvoiceDays),
        recipientName: text(supplier.name),
        recipientEmail: text(supplier.email),
        recipientPhone: text(supplier.phone),
        variables: baseVariables,
        caseId: text(relatedCase.id),
        clientId: text(relatedCase.client_id),
        supplierId: text(supplier.id),
        purchaseId: text(purchase.id),
        metadata: { case_code: relatedCase.case_code, service: purchase.service, supplier_name: supplier.name },
      });
      if (result.changed) planned += 1;
    }
  }

  let cancelled = 0;
  const stale = existing.filter((row) => MANAGED_KINDS.has(row.kind) && ["planned", "prepared"].includes(row.status) && !activeThreads.has(row.thread_key));
  for (const row of stale) {
    const now = new Date().toISOString();
    const { error } = await db.from("communication_followups").update({ status: "cancelled", cancelled_at: now, updated_at: now, metadata: { ...(row.metadata || {}), auto_resolution: "source_condition_resolved" } }).eq("id", row.id).eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    if (row.task_id) await db.from("tasks").update({ status: "cancelled", updated_at: now }).eq("id", row.task_id).eq("organization_id", organizationId).in("status", ["pending", "in_progress"]);
    cancelled += 1;
  }

  return { enabled: true, planned, cancelled, activeThreads: activeThreads.size };
}

export async function loadCommunicationWorkspace(organizationId: string) {
  await ensureDefaultCommunicationTemplates(organizationId);
  const db = getSupabaseAdminClient();
  const [templatesResult, followupsResult] = await Promise.all([
    db.from("communication_templates").select("id,key,name,audience,channel,subject_template,body_template,active,system_template,updated_at").eq("organization_id", organizationId).order("name").order("channel"),
    db.from("communication_followups").select("id,case_id,client_id,supplier_id,proposal_id,contract_id,purchase_id,task_id,kind,channel,recipient_name,recipient_email,recipient_phone,subject,body,status,due_at,sent_at,answered_at,cancelled_at,thread_key,sequence_step,next_followup_at,metadata,created_at,updated_at").eq("organization_id", organizationId).order("due_at", { ascending: true }).limit(500),
  ]);
  if (templatesResult.error) throw new Error(templatesResult.error.message);
  if (followupsResult.error) throw new Error(followupsResult.error.message);

  const followups = (followupsResult.data || []) as CommunicationFollowup[];
  return {
    templates: (templatesResult.data || []) as CommunicationTemplate[],
    followups,
    summary: {
      pending: followups.filter((row) => ["planned", "prepared"].includes(row.status)).length,
      due: followups.filter((row) => ["planned", "prepared"].includes(row.status) && new Date(row.due_at).getTime() <= Date.now()).length,
      sent: followups.filter((row) => row.status === "sent").length,
      answered: followups.filter((row) => row.status === "answered").length,
    },
  };
}

export async function updateCommunicationTemplate(input: {
  organizationId: string;
  templateId: string;
  name?: string;
  subjectTemplate?: string | null;
  bodyTemplate?: string;
  active?: boolean;
}) {
  const db = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = text(input.name).slice(0, 120);
  if (input.subjectTemplate !== undefined) patch.subject_template = input.subjectTemplate ? text(input.subjectTemplate).slice(0, 300) : null;
  if (input.bodyTemplate !== undefined) {
    const body = text(input.bodyTemplate);
    if (!body) throw new Error("template_body_required");
    patch.body_template = body.slice(0, 5000);
  }
  if (input.active !== undefined) patch.active = Boolean(input.active);

  const { data, error } = await db.from("communication_templates").update(patch).eq("id", input.templateId).eq("organization_id", input.organizationId).select("id,key,name,audience,channel,subject_template,body_template,active,system_template,updated_at").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("communication_template_not_found");
  return data as CommunicationTemplate;
}

export async function updateCommunicationFollowupStatus(input: {
  organizationId: string;
  followupId: string;
  actorId: string;
  status: Exclude<CommunicationStatus, "planned">;
}) {
  const db = getSupabaseAdminClient();
  const { data: current, error: currentError } = await db.from("communication_followups").select("id,case_id,client_id,supplier_id,task_id,kind,channel,recipient_name,status,sequence_step,metadata").eq("id", input.followupId).eq("organization_id", input.organizationId).maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("communication_followup_not_found");

  const currentStatus = text(current.status) as CommunicationStatus;
  const allowed = new Map<CommunicationStatus, CommunicationStatus[]>([
    ["planned", ["prepared", "sent", "cancelled"]],
    ["prepared", ["sent", "cancelled"]],
    ["sent", ["answered", "cancelled"]],
    ["answered", []],
    ["cancelled", []],
  ]);
  if (!(allowed.get(currentStatus) || []).includes(input.status)) throw new Error("invalid_communication_transition");

  const now = new Date().toISOString();
  const settings = await loadEffectiveSettings(input.organizationId);
  const repeatDays = Math.max(1, settings.number("communications.repeat_days", 3));
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.status === "sent") {
    patch.sent_at = now;
    patch.next_followup_at = new Date(Date.now() + repeatDays * 86_400_000).toISOString();
  }
  if (input.status === "answered") patch.answered_at = now;
  if (input.status === "cancelled") patch.cancelled_at = now;

  const { data, error } = await db.from("communication_followups").update(patch).eq("id", input.followupId).eq("organization_id", input.organizationId).select("id,case_id,client_id,supplier_id,proposal_id,contract_id,purchase_id,task_id,kind,channel,recipient_name,recipient_email,recipient_phone,subject,body,status,due_at,sent_at,answered_at,cancelled_at,thread_key,sequence_step,next_followup_at,metadata,created_at,updated_at").single();
  if (error) throw new Error(error.message);

  if (current.task_id && ["sent", "answered", "cancelled"].includes(input.status)) {
    const taskStatus = input.status === "cancelled" ? "cancelled" : "done";
    await db.from("tasks").update({ status: taskStatus, updated_at: now }).eq("id", current.task_id).eq("organization_id", input.organizationId).in("status", ["pending", "in_progress"]);
  }

  if (["sent", "answered", "cancelled"].includes(input.status)) {
    await db.from("timeline_events").insert({
      organization_id: input.organizationId,
      case_id: current.case_id || null,
      client_id: current.client_id || null,
      event_type: `communication.${input.status}`,
      title: input.status === "sent" ? "Comunicación registrada como enviada" : input.status === "answered" ? "Respuesta del contacto registrada" : "Seguimiento de comunicación cancelado",
      payload: {
        communication_followup_id: input.followupId,
        kind: current.kind,
        channel: current.channel,
        recipient_name: current.recipient_name,
        supplier_id: current.supplier_id,
        sequence_step: current.sequence_step,
      },
      created_by: input.actorId,
    });
  }

  return data as CommunicationFollowup;
}
