export type PurchaseStatus = "expected" | "requested" | "uploaded" | "holded_candidate" | "matched" | "review_needed" | "approved" | "not_required" | "cancelled";

export type PurchaseItem = {
  id: string;
  case_code: string;
  supplier: string;
  service: string;
  status: PurchaseStatus;
  amount: number;
  invoice_file?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_base?: number;
  invoice_tax?: number;
  invoice_total?: number;
  currency?: string;
  due_date?: string;
  not_required_reason?: string;
  review_notes?: string;
  notes?: string;
};

export const purchaseStatuses: PurchaseStatus[] = [
  "expected",
  "requested",
  "uploaded",
  "holded_candidate",
  "matched",
  "review_needed",
  "approved",
  "not_required",
  "cancelled",
];

export function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
}

export function invoiceDelta(item: PurchaseItem) {
  if (typeof item.invoice_total !== "number") return 0;
  return Math.round((item.invoice_total - item.amount + Number.EPSILON) * 100) / 100;
}

export function isPurchaseClosed(item: PurchaseItem) {
  return item.status === "approved" || item.status === "not_required" || item.status === "cancelled";
}

export function needsReview(item: PurchaseItem) {
  if (item.status === "review_needed" || item.status === "holded_candidate") return true;
  const delta = Math.abs(invoiceDelta(item));
  return Boolean(item.invoice_file && delta > 1);
}

export function purchaseTotals(items: PurchaseItem[]) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const closed = items.filter((item) => isPurchaseClosed(item));
  const pending = items.filter((item) => !isPurchaseClosed(item));
  const uploaded = items.filter((item) => Boolean(item.invoice_file));
  const reviewNeeded = items.filter((item) => needsReview(item));

  return {
    count: items.length,
    total,
    approvedCount: items.filter((item) => item.status === "approved").length,
    closedCount: closed.length,
    pendingCount: pending.length,
    uploadedCount: uploaded.length,
    reviewNeededCount: reviewNeeded.length,
    pendingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
  };
}
