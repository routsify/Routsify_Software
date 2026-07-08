import { cases, expectedPurchases } from "@/lib/mock-data";
import { demoTasks } from "@/lib/tasks";
import { demoDocuments } from "@/lib/documents";
import { demoCommunications } from "@/lib/communications";
import { demoPayments } from "@/lib/billing";
import { demoOutbox } from "@/lib/integrations";

export type WorkItem = {
  id: string;
  area: string;
  title: string;
  case_code?: string;
  owner: string;
  urgency: "critical" | "high" | "normal" | "low";
  reason: string;
  href: string;
  due_at?: string;
  source: string;
  score: number;
};

function score(urgency: WorkItem["urgency"]) {
  return urgency === "critical" ? 100 : urgency === "high" ? 80 : urgency === "normal" ? 50 : 20;
}

export function buildOperationalInbox(): WorkItem[] {
  const items: WorkItem[] = [];

  cases.filter((item) => item.blocker).forEach((item) => items.push({ id: `case-${item.case_code}`, area: "Expedientes", title: `Resolver bloqueo: ${item.title}`, case_code: item.case_code, owner: "Operaciones", urgency: "critical", reason: item.blocker || "Bloqueo operativo", href: `/expedientes/${item.case_code}`, due_at: item.trip_start, source: "case", score: 100 }));

  demoTasks.filter((item) => item.status !== "done").forEach((item) => {
    const urgency = item.status === "blocked" || item.priority === "urgent" ? "critical" : item.priority === "high" ? "high" : "normal";
    items.push({ id: item.id, area: item.area, title: item.title, case_code: item.case_code, owner: item.owner, urgency, reason: item.blocker || item.notes || item.status, href: `/expedientes/${item.case_code}`, due_at: item.due_date, source: "task", score: score(urgency) });
  });

  demoDocuments.filter((item) => item.status === "missing" || item.status === "expired").forEach((item) => {
    const urgency = item.status === "expired" ? "critical" : "high";
    items.push({ id: item.id, area: "Documentos", title: `Documento pendiente: ${item.title}`, case_code: item.case_code, owner: item.owner, urgency, reason: item.notes || item.status, href: "/documentos", due_at: item.expires_at, source: "document", score: score(urgency) });
  });

  expectedPurchases.filter((item) => item.status !== "approved").forEach((item) => items.push({ id: `purchase-${item.case_code}-${item.supplier}`, area: "Compras", title: `Compra proveedor pendiente: ${item.service}`, case_code: item.case_code, owner: "Operaciones", urgency: "high", reason: `${item.supplier} · ${item.status}`, href: "/compras", source: "purchase", score: 80 }));

  demoPayments.filter((item) => item.status === "pending" || item.status === "failed").forEach((item) => {
    const urgency = item.status === "failed" ? "critical" : "high";
    items.push({ id: item.id, area: "Pagos", title: `Cobro pendiente: ${item.client}`, case_code: item.case_code, owner: "Facturación", urgency, reason: `${item.method} · ${item.status}`, href: "/facturacion", due_at: item.received_at, source: "payment", score: score(urgency) });
  });

  demoCommunications.filter((item) => item.status === "open" || item.status === "waiting").forEach((item) => {
    const urgency = item.status === "waiting" ? "high" : "normal";
    items.push({ id: item.id, area: "Comunicaciones", title: item.subject, case_code: item.case_code, owner: item.owner, urgency, reason: `${item.contact} · ${item.channel}`, href: "/comunicaciones", due_at: item.follow_up_at || item.created_at, source: "communication", score: score(urgency) });
  });

  demoOutbox.filter((item) => item.status === "pending" || item.status === "failed").forEach((item) => {
    const urgency = item.status === "failed" ? "critical" : "normal";
    items.push({ id: item.id, area: "Integraciones", title: `Evento pendiente: ${item.event_type}`, case_code: item.related_case, owner: "Admin", urgency, reason: item.last_error || item.status, href: "/integraciones", due_at: item.created_at, source: "integration", score: score(urgency) });
  });

  return items.sort((a, b) => b.score - a.score || String(a.due_at || "").localeCompare(String(b.due_at || "")));
}

export function workbenchSummary(items: WorkItem[]) {
  const critical = items.filter((item) => item.urgency === "critical").length;
  const high = items.filter((item) => item.urgency === "high").length;
  const byArea = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.area] = (acc[item.area] || 0) + 1;
    return acc;
  }, {});
  return { total: items.length, critical, high, byArea };
}
