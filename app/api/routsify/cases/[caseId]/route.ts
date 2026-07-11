import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { updateCaseRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedStatuses = new Set([
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
]);

type CasePatch = Parameters<typeof updateCaseRepository>[1];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { caseId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data: existing, error: existingError } = await getSupabaseAdminClient()
    .from("cases")
    .select("id,trip_start,trip_end")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const updates: CasePatch = {};
  for (const key of ["title", "destination", "trip_start", "trip_end", "next_action", "blocker", "final_notes"] as const) {
    if (key in source) updates[key] = source[key] ? String(source[key]) : null;
  }

  const tripStart = "trip_start" in source ? (source.trip_start ? String(source.trip_start) : null) : existing.trip_start;
  const tripEnd = "trip_end" in source ? (source.trip_end ? String(source.trip_end) : null) : existing.trip_end;
  if (tripStart && tripEnd && tripStart > tripEnd) return NextResponse.json({ ok: false, error: "invalid_date_range" }, { status: 400 });

  if ("status" in source) {
    const status = String(source.status || "");
    if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    updates.status = status;
  }

  const result = await updateCaseRepository(caseId, updates);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
