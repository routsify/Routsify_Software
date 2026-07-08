import type { ContractItem } from "@/lib/contracts";

type CaseLike = {
  case_code: string;
  status: string;
  accepted_value: number;
};

type TravelerStatsLike = {
  ready: boolean;
  missing: number;
  expired: number;
};

export function contractBlockers(contract: ContractItem, currentCase: CaseLike | undefined, travelerStats: TravelerStatsLike) {
  const blockers: string[] = [];
  if (!currentCase) blockers.push("Expediente no encontrado");
  if (currentCase && currentCase.accepted_value <= 0 && currentCase.status !== "proposal_accepted") blockers.push("Propuesta no aceptada");
  if (!travelerStats.ready) blockers.push(`Documentación viajeros incompleta: ${travelerStats.missing} faltan, ${travelerStats.expired} caducados`);
  if (!contract.document_file && (contract.status === "sent" || contract.status === "signed")) blockers.push("Falta archivo de contrato");
  if (contract.amount <= 0) blockers.push("Importe de contrato no válido");
  return blockers;
}

export function canSendContract(contract: ContractItem, currentCase: CaseLike | undefined, travelerStats: TravelerStatsLike) {
  return contractBlockers(contract, currentCase, travelerStats).length === 0 && contract.status !== "signed" && contract.status !== "archived";
}

export function canSignContract(contract: ContractItem, currentCase: CaseLike | undefined, travelerStats: TravelerStatsLike) {
  return canSendContract(contract, currentCase, travelerStats) && Boolean(contract.document_file) && (contract.status === "sent" || contract.status === "draft");
}

export function contractNextAction(contract: ContractItem, currentCase: CaseLike | undefined, travelerStats: TravelerStatsLike) {
  const blockers = contractBlockers(contract, currentCase, travelerStats);
  if (contract.status === "signed") return "Contrato firmado. Avanzar a pago, compras y cierre.";
  if (blockers.length > 0) return `Resolver: ${blockers.join(" · ")}.`;
  if (contract.status === "draft") return "Enviar contrato para firma.";
  if (contract.status === "sent") return "Hacer seguimiento de firma.";
  if (contract.status === "blocked") return "Revalidar bloqueos y preparar borrador.";
  return "Preparar contrato desde propuesta aceptada.";
}
