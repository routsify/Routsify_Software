export type BudgetStatus = "draft" | "internal_review" | "sent" | "accepted" | "rejected" | "expired" | "locked";

export type BudgetMaster = {
  id: string;
  code: string;
  clientName: string;
  caseCode: string;
  destination: string;
  status: BudgetStatus;
  currentVersion: number;
  responsibleName: string;
  totalCostBudget: number;
  totalSalePrice: number;
  expectedProfit: number;
  expectedMarginPct: number;
  realCost?: number;
  holdedSyncStatus: "synced" | "pending" | "error";
  holdedLastError?: string;
  sentAt?: string;
  acceptedAt?: string;
  expiresAt?: string;
  lastActivityAt: string;
};
