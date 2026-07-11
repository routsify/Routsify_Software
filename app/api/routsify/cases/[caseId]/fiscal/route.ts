import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

const kinds = new Set(["proforma", "invoice", "credit_note", "receipt"]);
const statuses = new Set(["draft", "manual_review", "issued", "paid", "cancelled"]);
function numeric(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  const kind = String(body?.document_kind || "proforma");
  const requestedStatus = String(body?.status || "manual_review");
  const status = statuses.has(requestedStatus) ? requestedStatus : "manual_review";
  const amount = numeric(body?.amount);
  if (!kinds.has(kind) || amount < 0) return NextResponse.json({ ok: false, error: "invalid_fiscal_document" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase.from("cases").select("id,client_id,currency").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const idempotencyKey = String(body?.idempotency_key || `${kind}:${caseId}:${body?.document_number || "manual"}`).trim();
  const { data, error } = await supabase.from("billing_documents").upsert({
    organization_id: organizationId,
    case_id: caseId,
    client_id: caseRow.client_id,
    type: kind,
    trigger_name: "manual_review",
    document_number: String(body?.document_number || "").trim() || null,
    status,
    amount,
    tax_amount: numeric(body?.tax_amount),
    currency: String(body?.currency || caseRow.currency || "EUR"),
    issued_at: status === "issued" || status === "paid" ? new Date().toISOString() : null,
    external_document_id: String(body?.external_id || "").trim() || null,
    notes: String(body?.notes || "").trim() || null,
    idempotency_key: idempotencyKey,
    sync_message: "Pendiente de revisión fiscal manual.",
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,idempotency_key" }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: "fiscal.document_prepared", title: `Documento fiscal preparado: ${kind}`, payload: { billing_document_id: data.id, amount, status }, created_by: access.actorId });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
