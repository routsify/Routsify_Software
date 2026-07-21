import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Tables } from "@/lib/database.types";

type LeadRecord = Tables<"leads">;
type LeadReviewFields = Pick<
  LeadRecord,
  | "id"
  | "client_id"
  | "client_name"
  | "email"
  | "phone"
  | "destination"
  | "travel_start"
  | "travel_end"
  | "travelers"
  | "budget_hint"
  | "source"
  | "status"
  | "review_status"
  | "outcome"
  | "review_note"
  | "reviewed_at"
  | "archived_at"
  | "created_at"
  | "updated_at"
>;

export const leadReviewFilters = ["active", "archived", "converted", "won", "lost", "all"] as const;
export type LeadReviewFilter = (typeof leadReviewFilters)[number];

export type LeadReviewRow = LeadReviewFields & {
  clients: { id: string; display_name: string; email: string | null; phone: string | null } | null;
};

export type LeadReviewPage = {
  items: LeadReviewRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filter: LeadReviewFilter;
  query: string;
  stats: {
    active: number;
    archived: number;
    converted: number;
    won: number;
    lost: number;
    total: number;
  };
};

function safeFilter(value: unknown): LeadReviewFilter {
  return leadReviewFilters.includes(String(value) as LeadReviewFilter)
    ? String(value) as LeadReviewFilter
    : "active";
}

function safeSearch(value: unknown) {
  return String(value || "").trim().slice(0, 120).replace(/[,%()]/g, " ");
}

export async function listLeadReviewPage(
  organizationId: string,
  input: { page?: unknown; pageSize?: number; filter?: unknown; query?: unknown } = {},
): Promise<LeadReviewPage> {
  const db = getSupabaseAdminClient();
  const pageSize = Math.min(100, Math.max(20, input.pageSize || 40));
  const page = Math.max(1, Number(input.page) || 1);
  const filter = safeFilter(input.filter);
  const query = safeSearch(input.query);
  const offset = (page - 1) * pageSize;

  let rowsQuery = db
    .from("leads")
    .select(
      "id,client_id,client_name,email,phone,destination,travel_start,travel_end,travelers,budget_hint,source,status,review_status,outcome,review_note,reviewed_at,archived_at,created_at,updated_at,clients:clients!leads_client_id_fkey(id,display_name,email,phone)",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (filter === "active") rowsQuery = rowsQuery.eq("review_status", "pending");
  if (filter === "archived") rowsQuery = rowsQuery.eq("status", "archived");
  if (filter === "converted") rowsQuery = rowsQuery.eq("status", "converted");
  if (filter === "won") rowsQuery = rowsQuery.eq("outcome", "won");
  if (filter === "lost") rowsQuery = rowsQuery.eq("outcome", "lost");
  if (query) {
    rowsQuery = rowsQuery.or(
      `client_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,destination.ilike.%${query}%`,
    );
  }

  const [rowsResult, statsResult] = await Promise.all([
    rowsQuery.range(offset, offset + pageSize - 1),
    db
      .from("leads")
      .select("status,review_status,outcome")
      .eq("organization_id", organizationId),
  ]);

  if (rowsResult.error) throw new Error(rowsResult.error.message);
  if (statsResult.error) throw new Error(statsResult.error.message);

  const statsRows = statsResult.data || [];
  const total = rowsResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: (rowsResult.data || []) as unknown as LeadReviewRow[],
    page: Math.min(page, totalPages),
    pageSize,
    total,
    totalPages,
    filter,
    query,
    stats: {
      active: statsRows.filter((row) => row.review_status === "pending").length,
      archived: statsRows.filter((row) => row.status === "archived").length,
      converted: statsRows.filter((row) => row.status === "converted").length,
      won: statsRows.filter((row) => row.outcome === "won").length,
      lost: statsRows.filter((row) => row.outcome === "lost").length,
      total: statsRows.length,
    },
  };
}
