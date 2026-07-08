export type PaymentStatus = "pending" | "received" | "failed" | "refunded";
export type BillingDocumentStatus = "draft" | "blocked" | "ready" | "sent" | "synced" | "error";
export type BillingDocumentType = "proforma" | "invoice" | "final_invoice" | "regularization";

export type PaymentItem = {
  id: string;
  case_code: string;
  client: string;
  method: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  received_at?: string;
  reference?: string;
  notes?: string;
};

export type BillingDocument = {
  id: string;
  case_code: string;
  client: string;
  type: BillingDocumentType;
  amount: number;
  currency: string;
  status: BillingDocumentStatus;
  holded_document_id?: string;
  sync_message?: string;
};

export const paymentStatuses: PaymentStatus[] = ["pending", "received", "failed", "refunded"];
export const billingStatuses: BillingDocumentStatus[] = ["draft", "blocked", "ready", "sent", "synced", "error"];
export const billingTypes: BillingDocumentType[] = ["proforma", "invoice", "final_invoice", "regularization"];

export const demoPayments: PaymentItem[] = [
  {
    id: "payment-1",
    case_code: "EXP-2026-0002",
    client: "Carlos y Ana Vega",
    method: "transferencia_manual",
    amount: 4600,
    currency: "EUR",
    status: "received",
    received_at: "2026-02-10",
    reference: "TRF-DEMO-001",
    notes: "Primer pago confirmado manualmente.",
  },
  {
    id: "payment-2",
    case_code: "EXP-2026-0001",
    client: "Laura Martín",
    method: "transferencia_manual",
    amount: 1800,
    currency: "EUR",
    status: "pending",
    reference: "PENDIENTE",
    notes: "Pendiente de confirmación bancaria.",
  },
];

export const demoBillingDocuments: BillingDocument[] = [
  {
    id: "billing-1",
    case_code: "EXP-2026-0002",
    client: "Carlos y Ana Vega",
    type: "proforma",
    amount: 9200,
    currency: "EUR",
    status: "ready",
    sync_message: "Preparada para crear documento en Holded cuando se active la integración.",
  },
  {
    id: "billing-2",
    case_code: "EXP-2026-0001",
    client: "Laura Martín",
    type: "invoice",
    amount: 7200,
    currency: "EUR",
    status: "blocked",
    sync_message: "Pendiente de aceptación de propuesta y pago.",
  },
];

export function formatBillingMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
}

export function billingSummary(payments: PaymentItem[], documents: BillingDocument[]) {
  const received = payments.filter((payment) => payment.status === "received").reduce((sum, payment) => sum + payment.amount, 0);
  const pending = payments.filter((payment) => payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);
  const documentsReady = documents.filter((document) => document.status === "ready" || document.status === "sent").length;
  const documentsSynced = documents.filter((document) => document.status === "synced").length;
  const syncErrors = documents.filter((document) => document.status === "error").length;

  return { received, pending, documentsReady, documentsSynced, syncErrors };
}
