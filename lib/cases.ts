export type CaseItem = {
  id?: string;
  case_code: string;
  client: string;
  title: string;
  status: string;
  destination: string;
  trip_start: string;
  trip_end: string;
  next_action: string;
  blocker: string;
  accepted_value: number;
  currency: string;
};

export type CaseDraft = {
  client: string;
  title: string;
  destination: string;
  trip_start: string;
  trip_end: string;
  status: string;
  next_action: string;
  blocker: string;
};

export const caseStatuses = [
  "new_lead",
  "call_booked",
  "call_done",
  "budget_draft",
  "proposal_sent",
  "proposal_accepted",
  "contract_ready",
  "contract_signed",
  "payment_confirmed",
  "suppliers_pending",
  "ready_to_close",
  "closed",
];

export const emptyCaseDraft: CaseDraft = {
  client: "Laura Martín",
  title: "",
  destination: "",
  trip_start: "",
  trip_end: "",
  status: "new_lead",
  next_action: "",
  blocker: "",
};

export function createCaseCode(count: number) {
  return `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
}
