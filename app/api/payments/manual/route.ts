import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { ensureProformaForCase } from "@/lib/fiscal-workflow-server";
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
  const { data: signedContract } = await supabase.from("contracts").select("id").eq("case_id", caseId).eq("organization_id", organizationId).eq("status", "signed").limit(1).maybeSingle();
  if (!signedContract) return { ok: false as const, error: "signed_contract_required" };
  const { data: existingPayment } = await supabase.from("payments").select("id").eq("organization_id", organizationId).eq("payment_reference", reference).limit(1).maybeSingle();
  if (existingPayment) return { ok: false as const, error: "payment_reference_already_exists" };
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
  const db = getSupabaseAdminClient();
  const { data, error } = await db.rpc("confirm_external_payment", {
    target_org: organizationId,
    target_case: caseId,
    transaction_value: reference,
    payment_reference_value: reference,
    amount_value: amount,
    currency_value: String(body?.currency || preflight.caseRow.currency || "EUR"),
    provider_value: String(body?.method || "manual"),
    confirmed_timestamp: receivedAt,
    payment_payload: { notes: String(body?.notes || "").trim() || null, actor_id: access.actorId, confirmation_mode: "manual" },
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  try {
    const proforma = await ensureProformaForCase({ organizationId, caseId, actorId: access.actorId, paymentReference: reference });
    return NextResponse.json({ ok: true, data, payment_confirmed: true, fiscal_pending: false, proforma }, { status: 201 });
  } catch (caught) {
    const warning = caught instanceof Error ? caught.message : "proforma_queue_failed";
    const taskKey = `payment_fiscal_followup:${caseId}:${reference}`;
    await db.from("tasks").upsert({
      organization_id: organizationId,
      case_id: caseId,
      title: "Revisar proforma pendiente tras pago confirmado",
      status: "pending",
      priority: "high",
      due_at: new Date().toISOString(),
      idempotency_key: taskKey,
      payload: { action_type: "payment_fiscal_followup", payment_reference: reference, error: warning },
    }, { onConflict: "organization_id,idempotency_key" });
    await db.from("timeline_events").insert({
      organization_id: organizationId,
      case_id: caseId,
      event_type: "payment.fiscal_followup_required",
      title: "Pago confirmado; proforma pendiente de revisión",
      payload: { payment_reference: reference, error: warning },
      created_by: access.actorId,
    });
    return NextResponse.json({ ok: true, data, payment_confirmed: true, fiscal_pending: true, warning }, { status: 202 });
  }
}
