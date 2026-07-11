import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

const kinds = new Set(["proforma", "invoice", "credit_note", "receipt"]);
const statuses = new Set(["draft", "issued", "paid", "cancelled"]);
function numeric(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  const kind = String(body?.document_kind || "proforma");
  const status = String(body?.status || "draft");
  const amount = numeric(body?.amount);
  if (!kinds.has(kind) || !statuses.has(status) || amount < 0) return NextResponse.json({ ok: false, error: "invalid_fiscal_document" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase.from("cases").select("id,client_id,currency").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const { data, error } = await supabase.from("fiscal_documents").insert({
    organization_id: organizationId,
    case_id: caseId,
    client_id: caseRow.client_id,
    document_kind: kind,
    document_number: String(body?.document_number || "").trim() || null,
    status,
    amount,
    tax_amount: numeric(body?.tax_amount),
    currency: String(body?.currency || caseRow.currency || "EUR"),
    issued_at: status === "issued" || status === "paid" ? new Date().toISOString() : null,
    external_id: String(body?.external_id || "").trim() || null,
    notes: String(body?.notes || "").trim() || null,
  }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: "fiscal.document_created", title: `Documento fiscal creado: ${kind}`, payload: { fiscal_document_id: data.id, amount, status }, created_by: actorId });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
