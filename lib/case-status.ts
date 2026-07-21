import { Constants, type Enums } from "@/lib/database.types";

export type CaseStatus = Enums<"case_status">;

export const caseStatuses: readonly CaseStatus[] = Constants.public.Enums.case_status;

export function isCaseStatus(value: unknown): value is CaseStatus {
  return caseStatuses.includes(String(value) as CaseStatus);
}
