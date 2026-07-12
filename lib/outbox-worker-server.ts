// Compatibility entry point. The v1.1 worker executes holdedRequest handlers and updates integration_outbox safely.
export { processOutboxBatch, syncHoldedPurchaseCandidates } from "@/lib/outbox-worker-v11-server";
export type { OutboxWorkerResult } from "@/lib/outbox-worker-v11-server";
