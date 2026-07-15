import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type InboxCategory = "urgent" | "attention" | "commercial" | "operations";
export type InboxSeverity = "critical" | "high" | "medium" | "low";

export type OperationalInboxItem = {
  id: string;
  category: InboxCategory;
  severity: InboxSeverity;
  score: number;
  title: string;
  detail: string;
  reason: string;
  href: string;
  actionLabel: string;
  entityType: "task" | "case" | "proposal" | "purchase" | "booking" | "lead" | "contract" | "payment" | "document" | "traveler";
  taskId?: string | null;
  taskStatus?: string | null;
  dueAt?: string | null;
  caseCode?: string | null;
  clientName?: string | null;
};

export type OperationalInboxData = {
  generatedAt: string;
  nextBestAction: OperationalInboxItem | null;
  items: OperationalInboxItem[];
  summary: {
    total: number;
    urgent: number;
    attention: number;
    commercial: number;
    operations: number;
    dueToday: number;
    overdue: number;
  };
};

type Row = Record<string, unknown>;

const ACTIVE_CASE_STATUSES = new Set([
  "new_lead",
  "call_booked",
  "call_done",
  "budget_draft",
  "proposal_sent",
  "proposal_accepted",
  "contract_ready",
  "contract_sent",
  "contract_signed",
  "payment_pending",
  "payment_confirmed",
  "confirmed",
  "suppliers_pending",
  "traveling",
  "post_trip",
  "ready_to_close",
]);

const STAGES = [
  "new_lead",
  "call_booked",
  "call_done",
  "budget_draft",
  "proposal_sent",
  "proposal_accepted",
  "contract_ready",
  "contract_sent",
  "contract_signed",
  "payment_pending",
  "payment_confirmed",
  "confirmed",
  "suppliers_pending",
  "traveling",
  "post_trip",
  "ready_to_close",
  "closed",
];

function stageRank(value: unknown) {
  const index = STAGES.indexOf(String(value || "new_lead"));
  return index < 0 ? 0 : index;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestamp(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function one<T extends Row = Row>(value: unknown): T | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as T : null;
  return value && typeof value === "object" ? value as T : null;
}

function daysBetween(fromMs: number, toMs: number) {
  return Math.ceil((toMs - fromMs) / 86_400_000);
}

function ageDays(value: unknown, nowMs: number) {
  const valueMs = timestamp(value);
  if (!valueMs) return 0;
  return Math.max(0, Math.floor((nowMs - valueMs) / 86_400_000));
}

function groupByCase(rows: Row[] | null | undefined) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows || []) {
    const caseId = text(row.case_id);
    if (!caseId) continue;
    grouped.set(caseId, [...(grouped.get(caseId) || []), row]);
  }
  return grouped;
}

function priorityWeight(value: unknown) {
  const priority = text(value).toLowerCase();
  if (priority === "urgent") return 25;
  if (priority === "high") return 15;
  if (priority === "low") return -5;
  return 5;
}

function item(input: OperationalInboxItem) {
  return input;
}

function taskHref(task: Row) {
  const caseId = text(task.case_id);
  const clientId = text(task.client_id);
  if (caseId) return `/expedientes?caseId=${encodeURIComponent(caseId)}`;
  if (clientId) return `/clientes/${encodeURIComponent(clientId)}`;
  return "/hoy";
}

function caseHref(caseId: string) {
  return `/expedientes?caseId=${encodeURIComponent(caseId)}`;
}

function proposalHref(caseId: string) {
  return `/propuestas?caseId=${encodeURIComponent(caseId)}`;
}

function purchaseHref(caseId: string) {
  return `/compras?caseId=${encodeURIComponent(caseId)}`;
}

function clientName(clientMap: Map<string, Row>, clientId: unknown) {
  return text(clientMap.get(text(clientId))?.display_name) || null;
}

function caseCode(caseMap: Map<string, Row>, caseId: unknown) {
  return text(caseMap.get(text(caseId))?.case_code) || null;
}

export async function loadOperationalInbox(organizationId: string): Promise<OperationalInboxData> {
  const db = getSupabaseAdminClient();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const [
    clientsResult,
    casesResult,
    tasksResult,
    proposalsResult,
    contractsResult,
    paymentsResult,
    purchasesResult,
    documentsResult,
    travelersResult,
    leadsResult,
    bookingsResult,
  ] = await Promise.all([
    db.from("clients").select("id,display_name").eq("organization_id", organizationId).limit(500),
    db.from("cases").select("id,client_id,lead_id,case_code,title,status,destination,trip_start,trip_end,next_action,next_action_at,blocker,accepted_value,currency,last_activity_at,updated_at,priority").eq("organization_id", organizationId).neq("status", "closed").order("updated_at", { ascending: false }).limit(500),
    db.from("tasks").select("id,case_id,client_id,title,status,priority,due_at,blocker,payload,created_at,updated_at").eq("organization_id", organizationId).in("status", ["pending", "in_progress"]).order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    db.from("proposals").select("id,case_id,status,current_version_id,created_at,updated_at").eq("organization_id", organizationId).in("status", ["draft", "internal_review", "sent", "accepted"]).limit(500),
    db.from("contracts").select("id,case_id,status,created_at,updated_at").eq("organization_id", organizationId).limit(500),
    db.from("payments").select("id,case_id,status,amount,created_at,updated_at").eq("organization_id", organizationId).limit(1000),
    db.from("expected_purchases").select("id,case_id,status,required,active,due_date,supplier_name,service,expected_amount,approved_cost,created_at,updated_at").eq("organization_id", organizationId).eq("active", true).limit(1000),
    db.from("documents").select("id,case_id,status,required,document_type,created_at,updated_at").eq("organization_id", organizationId).eq("required", true).is("purged_at", null).limit(1000),
    db.from("travelers").select("id,case_id,review_status,document_expires_at,created_at,updated_at").eq("organization_id", organizationId).limit(1000),
    db.from("leads").select("id,client_id,status,destination,travel_start,created_at,updated_at").eq("organization_id", organizationId).limit(500),
    db.from("bookings").select("id,client_id,lead_id,starts_at,status,created_at,updated_at").eq("organization_id", organizationId).order("starts_at", { ascending: true, nullsFirst: false }).limit(500),
  ]);

  const firstError = [
    clientsResult.error,
    casesResult.error,
    tasksResult.error,
    proposalsResult.error,
    contractsResult.error,
    paymentsResult.error,
    purchasesResult.error,
    documentsResult.error,
    travelersResult.error,
    leadsResult.error,
    bookingsResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const clients = (clientsResult.data || []) as Row[];
  const cases = (casesResult.data || []) as Row[];
  const tasks = (tasksResult.data || []) as Row[];
  const proposals = (proposalsResult.data || []) as Row[];
  const contracts = (contractsResult.data || []) as Row[];
  const payments = (paymentsResult.data || []) as Row[];
  const purchases = (purchasesResult.data || []) as Row[];
  const documents = (documentsResult.data || []) as Row[];
  const travelers = (travelersResult.data || []) as Row[];
  const leads = (leadsResult.data || []) as Row[];
  const bookings = (bookingsResult.data || []) as Row[];

  const clientMap = new Map(clients.map((row) => [text(row.id), row]));
  const caseMap = new Map(cases.map((row) => [text(row.id), row]));
  const proposalMap = groupByCase(proposals);
  const contractMap = groupByCase(contracts);
  const paymentMap = groupByCase(payments);
  const purchaseMap = groupByCase(purchases);
  const documentMap = groupByCase(documents);
  const travelerMap = groupByCase(travelers);
  const caseLeadIds = new Set(cases.map((row) => text(row.lead_id)).filter(Boolean));
  const items: OperationalInboxItem[] = [];

  for (const task of tasks) {
    const dueMs = timestamp(task.due_at);
    const overdue = Boolean(dueMs && dueMs < nowMs);
    const dueToday = Boolean(dueMs && new Date(dueMs).toDateString() === new Date(nowMs).toDateString());
    const blocked = Boolean(text(task.blocker));
    const score = blocked ? 120 : overdue ? 100 + priorityWeight(task.priority) + Math.min(20, ageDays(task.due_at, nowMs)) : dueToday ? 78 + priorityWeight(task.priority) : 55 + priorityWeight(task.priority);
    const category: InboxCategory = blocked || overdue ? "urgent" : dueToday ? "operations" : text(task.priority) === "urgent" ? "attention" : "operations";
    const severity: InboxSeverity = blocked || (overdue && text(task.priority) === "urgent") ? "critical" : overdue ? "high" : dueToday ? "medium" : "low";
    const taskCaseCode = caseCode(caseMap, task.case_id);
    const taskClientName = clientName(clientMap, task.client_id || caseMap.get(text(task.case_id))?.client_id);
    items.push(item({
      id: `task:${text(task.id)}`,
      category,
      severity,
      score,
      title: text(task.title) || "Tarea pendiente",
      detail: [taskCaseCode, taskClientName].filter(Boolean).join(" · ") || "Tarea operativa",
      reason: blocked ? `Bloqueada: ${text(task.blocker)}` : overdue ? "Tarea vencida" : dueToday ? "Vence hoy" : task.due_at ? `Vence ${new Date(String(task.due_at)).toLocaleDateString("es-ES")}` : "Pendiente sin fecha",
      href: taskHref(task),
      actionLabel: "Abrir contexto",
      entityType: "task",
      taskId: text(task.id),
      taskStatus: text(task.status),
      dueAt: task.due_at ? text(task.due_at) : null,
      caseCode: taskCaseCode,
      clientName: taskClientName,
    }));
  }

  for (const row of cases) {
    const caseId = text(row.id);
    if (!caseId || !ACTIVE_CASE_STATUSES.has(text(row.status))) continue;
    const href = caseHref(caseId);
    const code = text(row.case_code) || "Expediente";
    const name = clientName(clientMap, row.client_id);
    const tripStartMs = row.trip_start ? new Date(`${text(row.trip_start)}T12:00:00`).getTime() : null;
    const daysToTrip = tripStartMs ? daysBetween(nowMs, tripStartMs) : null;
    const rank = stageRank(row.status);
    const acceptedValue = numberValue(row.accepted_value);
    const confirmedPaid = (paymentMap.get(caseId) || []).filter((payment) => ["confirmed", "paid", "received"].includes(text(payment.status))).reduce((sum, payment) => sum + numberValue(payment.amount), 0);
    const openPurchases = (purchaseMap.get(caseId) || []).filter((purchase) => purchase.required !== false && purchase.active !== false && !["approved", "not_required", "cancelled"].includes(text(purchase.status)));
    const requiredDocs = documentMap.get(caseId) || [];
    const missingDocs = requiredDocs.filter((document) => !["uploaded", "verified", "approved"].includes(text(document.status)));
    const caseTravelers = travelerMap.get(caseId) || [];
    const signedContract = (contractMap.get(caseId) || []).some((contract) => text(contract.status) === "signed");
    const nextActionAt = timestamp(row.next_action_at);

    if (text(row.blocker)) {
      items.push(item({ id: `case:blocker:${caseId}`, category: "urgent", severity: "critical", score: 118, title: `${code} · expediente bloqueado`, detail: [name, text(row.destination)].filter(Boolean).join(" · "), reason: text(row.blocker), href, actionLabel: "Resolver bloqueo", entityType: "case", caseCode: code, clientName: name }));
    }

    if (nextActionAt && nextActionAt < nowMs) {
      items.push(item({ id: `case:next-action-overdue:${caseId}`, category: "urgent", severity: "high", score: 98, title: text(row.next_action) || `${code} · próxima acción vencida`, detail: [code, name].filter(Boolean).join(" · "), reason: "La próxima acción está vencida", href, actionLabel: "Abrir expediente", entityType: "case", dueAt: text(row.next_action_at), caseCode: code, clientName: name }));
    } else if (nextActionAt && nextActionAt <= nowMs + 86_400_000) {
      items.push(item({ id: `case:next-action-today:${caseId}`, category: "operations", severity: "medium", score: 76, title: text(row.next_action) || `${code} · próxima acción`, detail: [code, name].filter(Boolean).join(" · "), reason: "Acción prevista en las próximas 24 horas", href, actionLabel: "Continuar expediente", entityType: "case", dueAt: text(row.next_action_at), caseCode: code, clientName: name }));
    }

    if (daysToTrip !== null && daysToTrip >= 0 && daysToTrip <= 30) {
      if (caseTravelers.length === 0 && rank >= stageRank("proposal_accepted")) {
        items.push(item({ id: `case:travelers:${caseId}`, category: daysToTrip <= 14 ? "urgent" : "attention", severity: daysToTrip <= 7 ? "critical" : "high", score: daysToTrip <= 7 ? 112 : 88, title: `${code} · faltan viajeros`, detail: [name, text(row.destination)].filter(Boolean).join(" · "), reason: `El viaje empieza en ${daysToTrip} días y no hay viajeros registrados`, href, actionLabel: "Completar viajeros", entityType: "traveler", caseCode: code, clientName: name }));
      }
      if (missingDocs.length > 0) {
        items.push(item({ id: `case:documents:${caseId}`, category: daysToTrip <= 14 ? "urgent" : "attention", severity: daysToTrip <= 7 ? "critical" : "high", score: daysToTrip <= 7 ? 114 : 90, title: `${code} · documentación incompleta`, detail: `${missingDocs.length} documento${missingDocs.length === 1 ? "" : "s"} requerido${missingDocs.length === 1 ? "" : "s"} pendiente${missingDocs.length === 1 ? "" : "s"}`, reason: `El viaje empieza en ${daysToTrip} días`, href, actionLabel: "Revisar documentación", entityType: "document", caseCode: code, clientName: name }));
      }
      if (acceptedValue > 0 && confirmedPaid < acceptedValue && rank >= stageRank("contract_signed")) {
        const pending = acceptedValue - confirmedPaid;
        items.push(item({ id: `case:payment:${caseId}`, category: daysToTrip <= 14 ? "urgent" : "attention", severity: daysToTrip <= 7 ? "critical" : "high", score: daysToTrip <= 7 ? 113 : 89, title: `${code} · pago pendiente`, detail: `${pending.toLocaleString("es-ES", { style: "currency", currency: text(row.currency) || "EUR" })} pendientes`, reason: `El viaje empieza en ${daysToTrip} días`, href, actionLabel: "Revisar pagos", entityType: "payment", caseCode: code, clientName: name }));
      }
      if (openPurchases.length > 0) {
        items.push(item({ id: `case:purchases:${caseId}`, category: daysToTrip <= 14 ? "urgent" : "attention", severity: daysToTrip <= 7 ? "critical" : "high", score: daysToTrip <= 7 ? 111 : 87, title: `${code} · compras pendientes`, detail: `${openPurchases.length} compra${openPurchases.length === 1 ? "" : "s"} sin cerrar`, reason: `El viaje empieza en ${daysToTrip} días`, href: purchaseHref(caseId), actionLabel: "Resolver compras", entityType: "purchase", caseCode: code, clientName: name }));
      }
    }

    if (rank >= stageRank("proposal_accepted") && rank < stageRank("contract_signed") && !signedContract) {
      items.push(item({ id: `case:contract:${caseId}`, category: "attention", severity: "high", score: 82, title: `${code} · contrato pendiente`, detail: [name, text(row.destination)].filter(Boolean).join(" · "), reason: "El presupuesto está aceptado pero el contrato no consta firmado", href, actionLabel: "Preparar contrato", entityType: "contract", caseCode: code, clientName: name }));
    }

    if (!text(row.next_action) && ageDays(row.last_activity_at || row.updated_at, nowMs) >= 7) {
      items.push(item({ id: `case:stale:${caseId}`, category: "attention", severity: "medium", score: 64, title: `${code} · sin siguiente paso`, detail: [name, text(row.destination)].filter(Boolean).join(" · "), reason: `Sin actividad útil desde hace ${ageDays(row.last_activity_at || row.updated_at, nowMs)} días`, href, actionLabel: "Definir siguiente acción", entityType: "case", caseCode: code, clientName: name }));
    }
  }

  for (const proposal of proposals) {
    const status = text(proposal.status);
    const caseId = text(proposal.case_id);
    const relatedCase = caseMap.get(caseId);
    const code = caseCode(caseMap, caseId) || "Presupuesto";
    const name = clientName(clientMap, relatedCase?.client_id);
    const days = ageDays(proposal.updated_at || proposal.created_at, nowMs);
    if (status === "sent" && days >= 3) {
      items.push(item({ id: `proposal:followup:${text(proposal.id)}`, category: "commercial", severity: days >= 7 ? "high" : "medium", score: days >= 7 ? 84 : 74, title: `${code} · seguimiento de presupuesto`, detail: [name, text(relatedCase?.destination)].filter(Boolean).join(" · "), reason: `Enviado hace ${days} días sin decisión final`, href: proposalHref(caseId), actionLabel: "Hacer seguimiento", entityType: "proposal", caseCode: code, clientName: name }));
    }
    if (["draft", "internal_review"].includes(status) && days >= 5) {
      items.push(item({ id: `proposal:stale:${text(proposal.id)}`, category: "attention", severity: "medium", score: 62, title: `${code} · presupuesto parado`, detail: [name, text(relatedCase?.destination)].filter(Boolean).join(" · "), reason: `Sin actualización desde hace ${days} días`, href: proposalHref(caseId), actionLabel: "Continuar presupuesto", entityType: "proposal", caseCode: code, clientName: name }));
    }
  }

  for (const purchase of purchases) {
    const status = text(purchase.status);
    if (["approved", "not_required", "cancelled"].includes(status)) continue;
    const purchaseId = text(purchase.id);
    const caseId = text(purchase.case_id);
    const code = caseCode(caseMap, caseId) || "Compra";
    const relatedCase = caseMap.get(caseId);
    const name = clientName(clientMap, relatedCase?.client_id);
    const dueMs = purchase.due_date ? new Date(`${text(purchase.due_date)}T23:59:59`).getTime() : null;
    if (dueMs && dueMs < nowMs) {
      items.push(item({ id: `purchase:overdue:${purchaseId}`, category: "urgent", severity: "high", score: 96, title: `${code} · compra vencida`, detail: [text(purchase.supplier_name), text(purchase.service)].filter(Boolean).join(" · ") || "Compra de proveedor", reason: `Venció el ${new Date(dueMs).toLocaleDateString("es-ES")}`, href: purchaseHref(caseId), actionLabel: "Resolver compra", entityType: "purchase", caseCode: code, clientName: name }));
    } else if (["uploaded", "matched", "review_needed", "holded_candidate"].includes(status)) {
      items.push(item({ id: `purchase:review:${purchaseId}`, category: "attention", severity: "high", score: 86, title: `${code} · compra lista para revisar`, detail: [text(purchase.supplier_name), text(purchase.service)].filter(Boolean).join(" · ") || "Compra de proveedor", reason: "Hay documentación o conciliación pendiente de decisión", href: purchaseHref(caseId), actionLabel: "Revisar compra", entityType: "purchase", caseCode: code, clientName: name }));
    } else if (status === "requested" && ageDays(purchase.updated_at || purchase.created_at, nowMs) >= 3) {
      items.push(item({ id: `purchase:requested:${purchaseId}`, category: "attention", severity: "medium", score: 70, title: `${code} · proveedor sin respuesta`, detail: [text(purchase.supplier_name), text(purchase.service)].filter(Boolean).join(" · ") || "Compra solicitada", reason: `Solicitada hace ${ageDays(purchase.updated_at || purchase.created_at, nowMs)} días`, href: purchaseHref(caseId), actionLabel: "Revisar proveedor", entityType: "purchase", caseCode: code, clientName: name }));
    }
  }

  for (const booking of bookings) {
    const startsMs = timestamp(booking.starts_at);
    const status = text(booking.status).toLowerCase();
    if (!startsMs || ["cancelled", "canceled", "completed", "done"].includes(status)) continue;
    const hoursUntil = (startsMs - nowMs) / 3_600_000;
    if (hoursUntil < -4 || hoursUntil > 48) continue;
    const lead = leads.find((row) => text(row.id) === text(booking.lead_id));
    const name = clientName(clientMap, booking.client_id || lead?.client_id);
    items.push(item({
      id: `booking:${text(booking.id)}`,
      category: "commercial",
      severity: hoursUntil <= 3 ? "high" : "medium",
      score: hoursUntil <= 3 ? 92 : hoursUntil <= 24 ? 82 : 72,
      title: hoursUntil <= 3 ? "Llamada comercial próxima" : "Llamada comercial programada",
      detail: [name, text(lead?.destination)].filter(Boolean).join(" · ") || "Reserva comercial",
      reason: hoursUntil < 0 ? "La hora prevista ya ha pasado" : hoursUntil <= 3 ? "Empieza en menos de 3 horas" : hoursUntil <= 24 ? "Programada para hoy" : "Programada para mañana",
      href: booking.client_id ? `/clientes/${encodeURIComponent(text(booking.client_id))}` : "/clientes",
      actionLabel: "Preparar llamada",
      entityType: "booking",
      clientName: name,
      dueAt: text(booking.starts_at),
    }));
  }

  for (const lead of leads) {
    const status = text(lead.status).toLowerCase();
    if (["lost", "rejected", "closed", "converted", "won"].includes(status) || caseLeadIds.has(text(lead.id))) continue;
    const days = ageDays(lead.updated_at || lead.created_at, nowMs);
    if (days < 1) continue;
    const name = clientName(clientMap, lead.client_id);
    items.push(item({ id: `lead:${text(lead.id)}`, category: "commercial", severity: days >= 3 ? "high" : "medium", score: days >= 3 ? 80 : 68, title: "Lead pendiente de avanzar", detail: [name, text(lead.destination)].filter(Boolean).join(" · ") || "Oportunidad comercial", reason: `Sin expediente creado después de ${days} día${days === 1 ? "" : "s"}`, href: lead.client_id ? `/clientes/${encodeURIComponent(text(lead.client_id))}` : "/clientes", actionLabel: "Revisar cliente", entityType: "lead", clientName: name }));
  }

  const deduped = new Map<string, OperationalInboxItem>();
  for (const current of items) {
    const existing = deduped.get(current.id);
    if (!existing || current.score > existing.score) deduped.set(current.id, current);
  }
  const sorted = [...deduped.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es"));
  const visible = sorted.slice(0, 100);
  const overdue = visible.filter((entry) => entry.reason.toLowerCase().includes("vencid") || (entry.dueAt && timestamp(entry.dueAt) && Number(timestamp(entry.dueAt)) < nowMs)).length;
  const dueToday = visible.filter((entry) => entry.reason.toLowerCase().includes("hoy") || (entry.dueAt && new Date(String(entry.dueAt)).toDateString() === new Date(nowMs).toDateString())).length;

  return {
    generatedAt: nowIso,
    nextBestAction: visible[0] || null,
    items: visible,
    summary: {
      total: visible.length,
      urgent: visible.filter((entry) => entry.category === "urgent").length,
      attention: visible.filter((entry) => entry.category === "attention").length,
      commercial: visible.filter((entry) => entry.category === "commercial").length,
      operations: visible.filter((entry) => entry.category === "operations").length,
      dueToday,
      overdue,
    },
  };
}
