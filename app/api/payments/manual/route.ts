import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";
import { enqueuePaymentFiscalFlow } from "@/lib/fiscal-workflow-server";

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
  const { data: signedContract, error: contractError } = await supabase.from("contracts").select("id,current_version_id").eq("case_id", caseId).eq("organization_id", organizationId).eq("status", "signed").maybeSingle();
  if (contractError) return { ok: false as const, error: contractError.message };
  if (!signedContract?.current_version_id) return { ok: false as const, error: "signed_contract_evidence_required" };
  const { data: signature } = await supabase.from("signature_evidence").select("id").eq("organization_id", organizationId).eq("contract_version_id", signedContract.current_version_id).maybeSingle();
  if (!signature) return { ok: false as const, error: "signed_contract_evidence_required" };
  return { ok: true as const, caseRow, contractVersionId: signedContract.current_version_id };
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
  const currency = String(body?.currency || preflight.caseRow.currency || "EUR");
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("confirm_external_payment", {
    target_org: organizationId,
    target_case: caseId,
    transaction_value: reference,
    payment_reference_value: reference,
    amount_value: amount,
    currency_value: currency,
    provider_value: String(body?.method || "teya_manual"),
    confirmed_timestamp: receivedAt,
    payment_payload: { notes: String(body?.notes || "").trim() || null, actor_id: access.actorId, confirmation_mode: "manual", payment_link_id: body?.paymentLinkId || null },
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const paymentRow = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const paymentId = String(paymentRow.payment_id || paymentRow.id || "");
  if (body?.paymentLinkId) await supabase.from("payment_links").update({ status: "confirmed", confirmed_at: receivedAt, updated_at: new Date().toISOString() }).eq("id", String(body.paymentLinkId)).eq("organization_id", organizationId);
  const fiscal = await enqueuePaymentFiscalFlow({ organizationId, caseId, paymentId, paymentReference: reference, paymentAmount: amount, currency, confirmedAt: receivedAt });
  return NextResponse.json({ ok: true, data, fiscal }, { status: 201 });
}
