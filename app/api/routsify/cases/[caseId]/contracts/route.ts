import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

const statuses = new Set(["draft", "sent", "signed", "cancelled"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "draft");
  if (!statuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_contract_status" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase.from("cases").select("id").eq("id", caseId).eq("organization_id", organizationId).maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const contractId = String(body?.id || "").trim();
  const payload = {
    organization_id: organizationId,
    case_id: caseId,
    title: String(body?.title || "Contrato de viaje").trim(),
    status,
    external_url: String(body?.external_url || "").trim() || null,
    signed_at: status === "signed" ? new Date().toISOString() : null,
    notes: String(body?.notes || "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const query = contractId ? supabase.from("contracts").update(payload).eq("id", contractId).eq("organization_id", organizationId).eq("case_id", caseId) : supabase.from("contracts").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  if (status === "signed") await supabase.from("cases").update({ status: "contract_signed", next_action: "Confirmar pago", updated_at: new Date().toISOString() }).eq("id", caseId).eq("organization_id", organizationId);
  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: `contract.${status}`, title: status === "signed" ? "Contrato firmado" : `Contrato actualizado: ${status}`, payload: { contract_id: data.id }, created_by: actorId });
  return NextResponse.json({ ok: true, data });
}
