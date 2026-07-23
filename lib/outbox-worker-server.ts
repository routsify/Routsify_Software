// Compatibility entry point. The v1.1 worker executes holdedRequest handlers and updates integration_outbox safely.
import { syncHoldedSupplierPayments } from "@/lib/holded-supplier-payments-server";
import { processOutboxBatch, syncHoldedPurchaseCandidates as syncHoldedPurchaseCandidatesBase } from "@/lib/outbox-worker-v11-server";

export { processOutboxBatch };
export type { OutboxWorkerResult } from "@/lib/outbox-worker-v11-server";

export async function syncHoldedPurchaseCandidates(
  organizationId: Parameters<typeof syncHoldedPurchaseCandidatesBase>[0],
  options: Parameters<typeof syncHoldedPurchaseCandidatesBase>[1] = {},
) {
  const safeOptions = (options || {}) as NonNullable<Parameters<typeof syncHoldedPurchaseCandidatesBase>[1]> & {
    targetPurchaseId?: string | null;
    since?: Date | string | null;
    until?: Date | string | null;
  };
  const payments = await syncHoldedSupplierPayments(String(organizationId), {
    startDate: safeOptions.since || null,
    endDate: safeOptions.until || null,
    targetPurchaseId: safeOptions.targetPurchaseId || null,
    triggerSource: "invoice_sync",
    recordRun: true,
  });
  if (!payments.ok) throw new Error(payments.error || "holded_supplier_payments_failed");
  const invoices = await syncHoldedPurchaseCandidatesBase(organizationId, options);
  return { ...invoices, supplierPayments: payments };
}
