import { budgetLines, cases, expectedPurchases } from "@/lib/mock-data";
import { calculateBudgetTotals } from "@/lib/budget";
import { demoBillingDocuments, demoPayments } from "@/lib/billing";
import { demoCommunications } from "@/lib/communications";
import { demoContracts } from "@/lib/contracts";
import { demoDocuments } from "@/lib/documents";
import { demoTasks } from "@/lib/tasks";
import { demoTravelers, travelerSummary } from "@/lib/travelers";

export type DemoStageKey =
  | "new_lead"
  | "call_booked"
  | "call_done"
  | "budget_draft"
  | "proposal_sent"
  | "proposal_accepted"
  | "documents_approved"
  | "contract_signed"
  | "payment_confirmed"
  | "suppliers_pending"
  | "ready_to_close"
  | "closed";

export type DemoStage = {
  key: DemoStageKey;
  label: string;
  done: boolean;
  blocked: boolean;
  action: string;
};

const stageOrder: DemoStageKey[] = [
  "new_lead",
  "call_booked",
  "call_done",
  "budget_draft",
  "proposal_sent",
  "proposal_accepted",
  "documents_approved",
  "contract_signed",
  "payment_confirmed",
  "suppliers_pending",
  "ready_to_close",
  "closed",
];

const stageLabel: Record<DemoStageKey, string> = {
  new_lead: "Nuevo lead",
  call_booked: "Llamada reservada",
  call_done: "Llamada realizada",
  budget_draft: "Presupuesto en preparación",
  proposal_sent: "Presupuesto enviado",
  proposal_accepted: "Presupuesto aceptado",
  documents_approved: "Documentación aprobada",
  contract_signed: "Contrato firmado",
  payment_confirmed: "Pago confirmado",
  suppliers_pending: "Proveedores pendientes",
  ready_to_close: "Listo para cierre",
  closed: "Cerrado",
};

export function normalizeCaseStage(status: string, acceptedValue = 0): DemoStageKey {
  if (status === "proposal_sent" && acceptedValue > 0) return "proposal_accepted";
  if (stageOrder.includes(status as DemoStageKey)) return status as DemoStageKey;
  if (status === "contract_ready") return "documents_approved";
  return "budget_draft";
}

export function buildDemoExpectedPurchasesFromBudget(caseCode: string) {
  return budgetLines
    .filter((line) => line.creates_expected_purchase && line.supplier_name && line.supplier_name !== "Routsify")
    .map((line) => ({
      budget_line_id: line.id,
      case_code: caseCode,
      supplier: line.supplier_name,
      service: line.service_type_code,
      destination: line.destination_segment || "General",
      amount: line.cost_budget,
      status: "expected",
      idempotency_key: `${caseCode}:${line.id}:${line.supplier_name}`,
    }));
}

export function getDemoExpeditionState(caseCode: string) {
  const currentCase = cases.find((item) => item.case_code === caseCode);
  if (!currentCase) return null;

  const purchases = expectedPurchases.filter((item) => item.case_code === caseCode);
  const travelers = demoTravelers.filter((item) => item.case_code === caseCode);
  const contracts = demoContracts.filter((item) => item.case_code === caseCode);
  const payments = demoPayments.filter((item) => item.case_code === caseCode);
  const billingDocs = demoBillingDocuments.filter((item) => item.case_code === caseCode);
  const documents = demoDocuments.filter((item) => item.case_code === caseCode);
  const tasks = demoTasks.filter((item) => item.case_code === caseCode && item.status !== "done");
  const communications = demoCommunications.filter((item) => item.case_code === caseCode);

  const travelerStats = travelerSummary(travelers);
  const budgetTotals = calculateBudgetTotals(budgetLines);
  const sale = currentCase.accepted_value || budgetTotals.totalSale;
  const received = payments.filter((payment) => payment.status === "received").reduce((sum, payment) => sum + payment.amount, 0);
  const pendingPayment = Math.max(sale - received, 0);
  const purchasePending = purchases.filter((purchase) => !["approved", "not_required", "cancelled"].includes(purchase.status)).length;
  const docsPending = documents.filter((document) => ["missing", "reviewing", "expired", "rejected"].includes(document.status)).length;
  const signed = contracts.some((contract) => contract.status === "signed");
  const accepted = currentCase.accepted_value > 0 || ["proposal_accepted", "contract_ready", "contract_signed", "payment_confirmed", "suppliers_pending", "ready_to_close", "closed"].includes(currentCase.status);
  const fiscalBlocked = billingDocs.some((doc) => doc.status === "blocked" || doc.status === "error");

  const blockers = [
    currentCase.blocker,
    !accepted ? "Presupuesto aún no aceptado" : "",
    !travelerStats.ready ? "Viajeros/documentos pendientes" : "",
    !signed ? "Contrato sin firma" : "",
    pendingPayment > 0 ? "Pago pendiente de confirmar" : "",
    purchasePending > 0 ? "Compras proveedor pendientes" : "",
    fiscalBlocked ? "Fiscalidad/Holded requiere revisión" : "",
    docsPending > 0 ? "Documentos internos pendientes" : "",
  ].filter(Boolean) as string[];

  const baseStage = normalizeCaseStage(currentCase.status, currentCase.accepted_value);
  const inferredStage: DemoStageKey = blockers.length === 0 ? "ready_to_close" : baseStage;
  const stageIndex = stageOrder.indexOf(inferredStage);
  const stages: DemoStage[] = stageOrder.map((key, index) => ({
    key,
    label: stageLabel[key],
    done: index < stageIndex || key === inferredStage && blockers.length === 0,
    blocked: key === inferredStage && blockers.length > 0,
    action: nextActionForStage(key),
  }));

  const timeline = [
    { when: "2026-02-01", title: "Solicitud recibida", detail: "Entrada demo desde formulario/booking con deduplicación por cliente." },
    { when: "2026-02-03", title: "Expediente creado", detail: `${currentCase.case_code} centraliza cliente, viaje y próximos pasos.` },
    { when: "2026-02-10", title: accepted ? "Presupuesto aceptado" : "Presupuesto en trabajo", detail: accepted ? "Snapshot económico y compras esperadas quedan bloqueadas." : "Faltan costes o seguimiento comercial." },
    { when: "2026-02-12", title: signed ? "Contrato firmado" : "Contrato pendiente", detail: signed ? "Firma registrada y pago habilitado." : "No habilitar avance completo sin firma o excepción auditada." },
    { when: "2026-02-13", title: purchasePending ? "Proveedor pendiente" : "Compras controladas", detail: purchasePending ? "Falta factura/match proveedor para cierre." : "Sin compras proveedor abiertas." },
  ];

  return {
    case: currentCase,
    travelers,
    travelerStats,
    contracts,
    payments,
    billingDocs,
    documents,
    tasks,
    communications,
    purchases,
    budgetTotals,
    sale,
    received,
    pendingPayment,
    purchasePending,
    docsPending,
    signed,
    accepted,
    blockers,
    stages,
    timeline,
    nextAction: blockers[0] || "Listo para revisar cierre operativo",
    canClose: blockers.length === 0,
  };
}

export function nextActionForStage(stage: DemoStageKey) {
  const actions: Record<DemoStageKey, string> = {
    new_lead: "Contactar o enviar enlace de llamada.",
    call_booked: "Realizar llamada o marcar no asistió.",
    call_done: "Crear presupuesto nativo.",
    budget_draft: "Completar costes y margen.",
    proposal_sent: "Hacer seguimiento.",
    proposal_accepted: "Solicitar viajeros y documentos.",
    documents_approved: "Generar contrato.",
    contract_signed: "Enviar o confirmar pago.",
    payment_confirmed: "Ejecutar modo fiscal / Holded.",
    suppliers_pending: "Cerrar compras proveedor.",
    ready_to_close: "Revisar preflight de cierre.",
    closed: "Medir rentabilidad real.",
  };
  return actions[stage];
}
