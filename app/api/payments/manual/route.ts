import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

function numeric(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const body = await request.json().catch(() => null);
  const caseId = String(body?.caseId || "").trim();
  const amount = numeric(body?.amount);
  const reference = String(body?.reference || "").trim();
  const method = String(body?.method || "transfer").trim();
  if (!caseId || amount <= 0 || reference.length < 3) return NextResponse.json({ ok: false, error: "case_amount_reference_required" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase.from("cases").select("id,case_code,status,accepted_value,currency").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  if (numeric(caseRow.accepted_value) <= 0) return NextResponse.json({ ok: false, error: "accepted_proposal_required" }, { status: 409 });

  const { data: existing } = await supabase.from("payments").select("id").eq("organization_id", organizationId).eq("payment_reference", reference).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "payment_reference_exists" }, { status: 409 });

  const confirmedAt = body?.receivedAt ? new Date(String(body.receivedAt)).toISOString() : new Date().toISOString();
  const { data, error } = await supabase.from("payments").insert({ organization_id: organizationId, case_id: caseId, payment_reference: reference, provider: "manual", method, amount, currency: String(body?.currency || caseRow.currency || "EUR"), status: "confirmed", confirmed_at: confirmedAt, payload: { notes: String(body?.notes || "").trim() || null, actor_id: actorId } }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const { data: payments } = await supabase.from("payments").select("amount").eq("organization_id", organizationId).eq("case_id", caseId).eq("status", "confirmed");
  const paid = (payments || []).reduce((sum, item) => sum + numeric(item.amount), 0);
  const accepted = numeric(caseRow.accepted_value);
  const fullyPaid = paid >= accepted;
  await supabase.from("cases").update({ status: fullyPaid ? "payment_confirmed" : caseRow.status, next_action: fullyPaid ? "Confirmar reservas con proveedores" : `Cobro parcial: ${paid.toFixed(2)} de ${accepted.toFixed(2)} EUR`, updated_at: confirmedAt }).eq("id", caseId).eq("organization_id", organizationId);
  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: "payment.confirmed", title: `Pago confirmado: ${amount.toFixed(2)} ${caseRow.currency || "EUR"}`, payload: { payment_id: data.id, reference, fully_paid: fullyPaid, total_paid: paid }, created_by: actorId });

  return NextResponse.json({ ok: true, data, summary: { total_paid: paid, accepted_value: accepted, fully_paid: fullyPaid } }, { status: 201 });
}
