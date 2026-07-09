import type { PurchaseItem } from "@/lib/purchases";

export type HoldedPurchaseCandidate = {
  id: string;
  supplier: string;
  amount: number;
  date: string;
  concept: string;
  confidence: "alta" | "media" | "baja";
  reasons: string[];
};

const demoCandidates: HoldedPurchaseCandidate[] = [
  { id: "holded-purchase-1", supplier: "Hotel Aurora Kyoto", amount: 2600, date: "2026-02-12", concept: "EXP-2026-0001 hotel Kioto", confidence: "alta", reasons: ["EXP_CODE", "proveedor", "importe"] },
  { id: "holded-purchase-2", supplier: "Japan Private Transfers", amount: 940, date: "2026-02-13", concept: "Traslados Tokio Kioto", confidence: "media", reasons: ["proveedor", "destino", "importe con diferencia"] },
  { id: "holded-purchase-3", supplier: "Lodge Arenal", amount: 3100, date: "2026-02-14", concept: "EXP-2026-0002 Arenal lodge honeymoon", confidence: "alta", reasons: ["EXP_CODE", "proveedor", "importe"] },
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function findHoldedCandidates(purchase: PurchaseItem): HoldedPurchaseCandidate[] {
  const supplier = normalize(purchase.supplier);
  return demoCandidates
    .filter((candidate) => normalize(candidate.supplier).includes(supplier) || normalize(candidate.concept).includes(normalize(purchase.case_code)))
    .map((candidate) => {
      const delta = Math.abs(candidate.amount - purchase.amount);
      const confidence = candidate.concept.includes(purchase.case_code) && delta <= 1 ? "alta" : delta <= 50 ? "media" : "baja";
      const reasons = [
        candidate.concept.includes(purchase.case_code) ? "EXP_CODE" : "sin EXP_CODE",
        normalize(candidate.supplier).includes(supplier) ? "proveedor" : "proveedor similar",
        delta <= 1 ? "importe exacto" : `diferencia ${delta.toLocaleString("es-ES")} €`,
      ];
      return { ...candidate, confidence, reasons };
    });
}

export function bestHoldedCandidate(purchase: PurchaseItem) {
  const candidates = findHoldedCandidates(purchase);
  return candidates.find((candidate) => candidate.confidence === "alta") || candidates[0];
}

export function matchAction(candidate?: HoldedPurchaseCandidate) {
  if (!candidate) return "Sin candidato: reclamar factura proveedor.";
  if (candidate.confidence === "alta") return "Aprobar match y vincular compra real.";
  if (candidate.confidence === "media") return "Revisión manual antes de aprobar.";
  return "No vincular sin intervención humana.";
}
