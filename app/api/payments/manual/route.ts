import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

function numeric(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }

async function paymentPreflight(organizationId: string, caseId: string, amount: number, reference: string) {
  if (!reference) return { ok: false as const, error: "payment_reference_required" };
  if (amount <= 0) return { ok: false as const, error: "payment_amount_required" };
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error } = await supabase.from("cases").select("id,status,accepted_value,currency").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!caseRow) return { ok: false as const, error: "case_not_found" };
  if (numeric(caseRow.accepted_value) <= 0) return { ok: false as const, error: "proposal_not_accepted" };
  const { data: accepted } = await supabase.from("proposals").select("id,current_version_id").eq("case_id", caseId).eq("organization_id", organizationId).eq("status", "accepted").maybeSingle();
  if (!accepted?.current_version_id) return { ok: false as const, error: "proposal_not_accepted" };
  return { ok: true as const, caseRow };
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  const caseId = String(body?.caseId || "").trim();
  const amount = numeric(body?.amount);
  const reference = String(body?.reference || "").trim();
  if (!caseId) return NextResponse.json({ ok: false, error: "case_required" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const preflight = await paymentPreflight(organizationId, caseId, amount, reference);
  if (!preflight.ok) return NextResponse.json(preflight, { status: preflight.error === "case_not_found" ? 404 : 409 });

  const receivedAt = body?.receivedAt ? new Date(String(body.receivedAt)).toISOString() : new Date().toISOString();
  const { data, error } = await getSupabaseAdminClient().rpc("confirm_external_payment", {
    target_org: organizationId,
    target_case: caseId,
    transaction_value: reference,
    payment_reference_value: reference,
    amount_value: amount,
    currency_value: String(body?.currency || preflight.caseRow.currency || "EUR"),
    provider_value: String(body?.method || "manual"),
    confirmed_timestamp: receivedAt,
    payment_payload: { notes: String(body?.notes || "").trim() || null, actor_id: access.actorId, confirmation_mode: "manual_review" },
  });
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data }, { status: 201 });
}
