export type ContractStatus = "not_started" | "draft" | "sent" | "signed" | "blocked" | "archived";

export type ContractItem = {
  id: string;
  case_code: string;
  client: string;
  proposal_version: string;
  status: ContractStatus;
  amount: number;
  currency: string;
  travelers_ready: boolean;
  payment_required_before_signature: boolean;
  document_file?: string;
  signed_at?: string;
  blocker?: string;
  notes?: string;
};

export const contractStatuses: ContractStatus[] = ["not_started", "draft", "sent", "signed", "blocked", "archived"];

export const demoContracts: ContractItem[] = [
  {
    id: "contract-1",
    case_code: "EXP-2026-0001",
    client: "Laura Martín",
    proposal_version: "v1",
    status: "blocked",
    amount: 7200,
    currency: "EUR",
    travelers_ready: false,
    payment_required_before_signature: false,
    blocker: "Falta documentación mínima de todos los viajeros.",
    notes: "No enviar contrato hasta completar documentación.",
  },
  {
    id: "contract-2",
    case_code: "EXP-2026-0002",
    client: "Carlos y Ana Vega",
    proposal_version: "v2",
    status: "sent",
    amount: 9200,
    currency: "EUR",
    travelers_ready: true,
    payment_required_before_signature: false,
    document_file: "contrato-costa-rica-demo.pdf",
    notes: "Enviado para firma externa.",
  },
];

export function contractSummary(items: ContractItem[]) {
  const signed = items.filter((item) => item.status === "signed").length;
  const blocked = items.filter((item) => item.status === "blocked" || !item.travelers_ready).length;
  const sent = items.filter((item) => item.status === "sent").length;
  const draft = items.filter((item) => item.status === "draft" || item.status === "not_started").length;
  return { total: items.length, signed, blocked, sent, draft };
}

export function formatContractMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
}
