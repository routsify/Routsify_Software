// Compatibility entry point for the current Holded API v2 implementation.
export { handleHoldedOutbox, syncHoldedPurchaseCandidates } from "@/lib/holded-outbox-handlers-v2";
export type { WorkerOutcome, WorkerRow } from "@/lib/holded-outbox-handlers-v2";
