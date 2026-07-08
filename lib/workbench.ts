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

function priorityScore(urgency: WorkItem["urgency"]) {
  if (urgency === "critical") return 100;
  if (urgency === "high") return 80;
  if (urgency === "normal") return 50;
  return 20;
}

export function buildOperationalInbox(): WorkItem[] {
  const blockedCases = cases.filter((item) => item.blocker).map((item) => ({
    id: `case-${item.case_code}`,
    area: "Expedientes",
    title: `Resolver bloqueo: ${item.title}`,
    case_code: item.case_code,
    owner: "Operaciones",
    urgency: "critical" as const,
    reason: item.blocker || "Bloqueo operativo",
    href: `/expedientes/${item.case_code}`,
    due_at: item.trip_start,
    source: "case_blocker",
    score: 100,
  }));

  const openTasks = demoTasks.filter((item) => item.status !== "done").map((item) => {
    const urgency = item.status === "blocked" || item.priority === "urgent" ? "critical" : item.priority === "high" ? "high" : "normal";
    return {
      id: item.id,
      area: item.area,
      title: item.title,
      case_code: item.case_code,
      owner: item.owner,
      urgency,
      reason: item.blocker || item.notes || item.status,
      href: `/expedientes/${item.case_code}`,
      due_at: item.due_date,
      source: "task",
      score: priorityScore(urgency),
    };
  });

  const missingDocuments = demoDocuments.filter((item) => item.status === "missing" || item.status === "expired").map((item) => ({
    id: item.id,
    area: "Documentos",
    title: `Documento pendiente: ${item.title}`,
    case_code: item.case_code,
    owner: item.owner,
    urgency: item.status === "expired" ? "critical" as const : "high" as const,
    reason: item.notes || item.status,
    href: "/documentos",
    due_at: item.expires_at,
    source: "document",
    score: item.status === "expired" ? 100 : 80,
  }));

  const supplierPurchases = expectedPurchases.filter((item) => item.status !== "approved").map((item) => ({
    id: `purchase-${item.case_code}-${item.supplier}`,
    area: "Compras",
    title: `Compra proveedor pendiente: ${item.service}`,
    case_code: item.case_code,
    owner: "Operaciones",
    urgency: item.status === "rejected" ? "critical" as const : "high" as const,
    reason: `${item.supplier} · ${item.status}`,
    href: "/compras",
    due_at: undefined,
    source: "expected_purchase",
    score: item.status === "rejected" ? 100 : 80,
  }));

  const pendingPayments = demoPayments.filter((item) => item.status === "pending" || item.status === "failed").map((item) => ({
    id: item.id,
    area: "Pagos",
    title: `Cobro pendiente: ${item.client}`,
    case_code: item.case_code,
    owner: "Facturación",
    urgency: item.status === "failed" ? "critical" as const : "high" as const,
    reason: `${item.method} · ${item.status}`,
    href: "/facturacion",
    due_at: item.received_at,
    source: "payment",
    score: item.status === "failed" ? 100 : 80,
  }));

  const waitingComms = demoCommunications.filter((item) => item.status === "open" || item.status === "waiting").map((item) => ({
    id: item.id,
    area: "Comunicaciones",
    title: item.subject,
    case_code: item.case_code,
    owner: item.owner,
    urgency: item.status === "waiting" ? "high" as const : "normal" as const,
    reason: `${item.contact} · ${item.channel}`,
    href: "/comunicaciones",
    due_at: item.follow_up_at || item.created_at,
    source: "communication",
    score: item.status === "waiting" ? 80 : 50,
  }));

  const integrationErrors = demoOutbox.filter((item) => item.status === "failed" || item.status === "pending").map((item) => ({
    id: item.id,
    area: "Integraciones",
    title: `Evento pendiente: ${item.event_type}`,
    case_code: item.case_code,
    owner: "Admin",
    urgency: item.status === "failed" ? "critical" as const : "normal" as const,
    reason: item.last_error || item.status,
    href: "/integraciones",
    due_at: item.created_at,
    source: "integration_outbox",
    score: item.status === "failed" ? 100 : 50,
  }));

  return [...blockedCases, ...openTasks, ...missingDocuments, ...supplierPurchases, ...pendingPayments, ...waitingComms, ...integrationErrors]
    .sort((a, b) => b.score - a.score || String(a.due_at || "").localeCompare(String(b.due_at || "")));
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
