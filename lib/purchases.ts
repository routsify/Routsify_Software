export type PurchaseStatus = "expected" | "requested" | "invoice_uploaded" | "reviewing" | "approved" | "rejected";

export type PurchaseItem = {
  id: string;
  case_code: string;
  supplier: string;
  service: string;
  status: PurchaseStatus;
  amount: number;
  invoice_file?: string;
  invoice_number?: string;
  due_date?: string;
  notes?: string;
};

export const purchaseStatuses: PurchaseStatus[] = [
  "expected",
  "requested",
  "invoice_uploaded",
  "reviewing",
  "approved",
  "rejected",
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function purchaseTotals(items: PurchaseItem[]) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const approved = items.filter((item) => item.status === "approved");
  const pending = items.filter((item) => item.status !== "approved");
  const uploaded = items.filter((item) => Boolean(item.invoice_file));

  return {
    count: items.length,
    total,
    approvedCount: approved.length,
    pendingCount: pending.length,
    uploadedCount: uploaded.length,
    pendingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
  };
}
