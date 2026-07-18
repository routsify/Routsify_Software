import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export type Client360Data = {
  client: Record<string, unknown>;
  leads: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  cases: Record<string, unknown>[];
  proposals: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
  filloutUrl: string;
  asOf: string;
};

const CLIENT_360_PROPOSAL_SELECT = "id,organization_id,case_id,status,current_version_id,created_at,updated_at,current_version:proposal_versions!proposals_current_version_fk(id,version_number,status,total_sale,total_cost,total_cost_budget,budgeted_profit,total_cost_real,real_profit,real_margin_pct,cost_deviation,accepted_at,created_at)" as const;

function settingValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) return String((value as { value?: unknown }).value || "");
  return "";
}

export async function getOrganizationClient360(organizationId: string, clientId: string): Promise<{ ok: true; data: Client360Data } | { ok: false; error: string }> {
  if (!hasSupabaseAdminEnv()) return { ok: false, error: "supabase_admin_not_configured" };
  const db = getSupabaseAdminClient();
  const { data: client, error: clientError } = await db
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) return { ok: false, error: clientError.message };
  if (!client) return { ok: false, error: "client_not_found" };

  const [leadsResult, bookingsResult, tasksResult, casesResult, timelineResult, settingResult] = await Promise.all([
    db.from("leads")
      .select("id,client_id,source,status,campaign,destination,travel_start,travel_end,travelers,budget_hint,possible_duplicate_client_id,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("bookings")
      .select("id,client_id,lead_id,external_booking_id,external_id,event_type,event_timestamp,starts_at,ends_at,status,source,payload,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("starts_at", { ascending: false })
      .limit(100),
    db.from("tasks")
      .select("id,client_id,case_id,title,status,priority,due_at,payload,blocker,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100),
    db.from("cases")
      .select("id,client_id,lead_id,case_code,title,status,responsible_user_id,destination,trip_start,trip_end,next_action,next_action_at,blocker,accepted_value,currency,last_activity_at,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("timeline_events")
      .select("id,client_id,case_id,event_type,title,payload,created_by,created_at")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("routsify_settings")
      .select("value")
      .eq("organization_id", organizationId)
      .eq("key", "integrations.fillout.public_url")
      .maybeSingle(),
  ]);

  const firstError = [leadsResult.error, bookingsResult.error, tasksResult.error, casesResult.error, timelineResult.error].find(Boolean);
  if (firstError) return { ok: false, error: firstError.message };

  const cases = (casesResult.data || []) as Record<string, unknown>[];
  const caseIds = cases.map((item) => String(item.id || "")).filter(Boolean);
  let proposals: Record<string, unknown>[] = [];
  let payments: Record<string, unknown>[] = [];

  if (caseIds.length) {
    const [proposalResult, paymentResult] = await Promise.all([
      db.from("proposals")
        .select(CLIENT_360_PROPOSAL_SELECT)
        .eq("organization_id", organizationId)
        .in("case_id", caseIds)
        .order("created_at", { ascending: false }),
      db.from("payments")
        .select("id,case_id,payment_reference,provider,method,amount,currency,status,confirmed_at,received_at,created_at")
        .eq("organization_id", organizationId)
        .in("case_id", caseIds)
        .order("created_at", { ascending: false }),
    ]);
    if (proposalResult.error) return { ok: false, error: proposalResult.error.message };
    if (paymentResult.error) return { ok: false, error: paymentResult.error.message };
    proposals = (proposalResult.data || []) as Record<string, unknown>[];
    payments = (paymentResult.data || []) as Record<string, unknown>[];
  }

  return {
    ok: true,
    data: {
      client: client as Record<string, unknown>,
      leads: (leadsResult.data || []) as Record<string, unknown>[],
      bookings: (bookingsResult.data || []) as Record<string, unknown>[],
      tasks: (tasksResult.data || []) as Record<string, unknown>[],
      cases,
      proposals,
      payments,
      timeline: (timelineResult.data || []) as Record<string, unknown>[],
      filloutUrl: settingValue(settingResult.data?.value),
      asOf: new Date().toISOString(),
    },
  };
}
