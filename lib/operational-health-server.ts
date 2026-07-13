import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export async function loadOperationalHealth(organizationId: string) {
  const db = getSupabaseAdminClient();
  const [{ data: cases, error }, { data: proposals }, { data: travelers }, { data: contracts }, { data: payments }, { data: purchases }, { data: documents }, { data: tasks }, { data: outbox }, { data: runs }] = await Promise.all([
    db.from("cases").select("id,case_code,title,status,destination,trip_start,next_action,accepted_value,blocker,close_blockers").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
    db.from("proposals").select("case_id,status").eq("organization_id", organizationId),
    db.from("travelers").select("case_id").eq("organization_id", organizationId),
    db.from("contracts").select("case_id,status").eq("organization_id", organizationId),
    db.from("payments").select("case_id,status,amount").eq("organization_id", organizationId),
    db.from("expected_purchases").select("case_id,status,required,active").eq("organization_id", organizationId),
    db.from("documents").select("case_id,status,required,purged_at").eq("organization_id", organizationId).is("purged_at", null),
    db.from("tasks").select("id,case_id,title,status,priority,due_at").eq("organization_id", organizationId).neq("status", "done"),
    db.from("integration_outbox").select("id,channel,event_type,status,last_error,created_at").eq("organization_id", organizationId).in("status", ["pending", "retry", "failed", "manual_review"]).limit(100),
    db.from("integration_runs").select("id,integration,status,started_at,finished_at").order("started_at", { ascending: false }).limit(10),
  ]);
  if (error) throw new Error(error.message);

  const grouped = <T extends { case_id?: string | null }>(rows: T[] | null) => {
    const result = new Map<string, T[]>();
    for (const row of rows || []) if (row.case_id) result.set(row.case_id, [...(result.get(row.case_id) || []), row]);
    return result;
  };
  const proposalMap = grouped(proposals);
  const travelerMap = grouped(travelers);
  const contractMap = grouped(contracts);
  const paymentMap = grouped(payments);
  const purchaseMap = grouped(purchases);
  const documentMap = grouped(documents);
  const active = new Set(["new_lead", "call_booked", "call_done", "budget_draft", "proposal_sent", "proposal_accepted", "contract_sent", "contract_signed", "payment_pending", "confirmed", "traveling", "post_trip"]);

  const caseHealth = (cases || []).filter((row) => active.has(String(row.status))).map((row) => {
    const requiredDocuments = (documentMap.get(row.id) || []).filter((item) => item.required);
    const requiredPurchases = (purchaseMap.get(row.id) || []).filter((item) => item.required && item.active);
    const paid = (paymentMap.get(row.id) || []).filter((item) => ["confirmed", "paid", "received"].includes(String(item.status))).reduce((sum, item) => sum + numeric(item.amount), 0);
    const checks: Array<[string, boolean]> = [
      ["próxima acción", Boolean(row.next_action)],
      ["presupuesto aceptado", (proposalMap.get(row.id) || []).some((item) => item.status === "accepted") || numeric(row.accepted_value) > 0],
      ["viajeros", (travelerMap.get(row.id) || []).length > 0],
      ["documentación", requiredDocuments.every((item) => ["uploaded", "verified", "approved"].includes(String(item.status)))],
      ["contrato firmado", (contractMap.get(row.id) || []).some((item) => item.status === "signed")],
      ["pago", numeric(row.accepted_value) <= 0 || paid >= numeric(row.accepted_value)],
      ["compras", requiredPurchases.every((item) => ["approved", "not_required", "cancelled"].includes(String(item.status)))],
      ["sin bloqueos", !row.blocker && !(Array.isArray(row.close_blockers) && row.close_blockers.length)],
    ];
    const completed = checks.filter(([, ok]) => ok).length;
    return { id: row.id, caseCode: row.case_code, title: row.title, status: row.status, destination: row.destination, tripStart: row.trip_start, score: Math.round(completed / checks.length * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
  }).sort((a, b) => a.score - b.score);

  const overdueTasks = (tasks || []).filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now());
  const failedOutbox = (outbox || []).filter((item) => ["failed", "manual_review"].includes(String(item.status)));
  const alerts = [
    ...caseHealth.filter((item) => item.score < 100).map((item) => ({ id: `case:${item.id}`, severity: item.score < 50 ? "high" : "medium", title: `${item.caseCode} · salud ${item.score}%`, detail: `Falta: ${item.missing.join(", ")}`, href: `/expedientes/${item.id}` })),
    ...overdueTasks.map((item) => ({ id: `task:${item.id}`, severity: item.priority === "urgent" ? "critical" : "high", title: `Tarea vencida · ${item.title}`, detail: "Requiere revisión inmediata.", href: item.case_id ? `/expedientes/${item.case_id}` : "/hoy" })),
    ...failedOutbox.map((item) => ({ id: `outbox:${item.id}`, severity: "high", title: `Integración pendiente · ${item.channel || item.event_type}`, detail: item.last_error || "Revisión manual necesaria.", href: "/control" })),
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: { activeCases: caseHealth.length, healthyCases: caseHealth.filter((item) => item.score === 100).length, averageHealth: caseHealth.length ? Math.round(caseHealth.reduce((sum, item) => sum + item.score, 0) / caseHealth.length) : 100, alerts: alerts.length, criticalAlerts: alerts.filter((item) => item.severity === "critical").length, openTasks: (tasks || []).length, pendingOutbox: (outbox || []).length, failedOutbox: failedOutbox.length },
    caseHealth,
    alerts,
    latestRuns: runs || [],
  };
}
