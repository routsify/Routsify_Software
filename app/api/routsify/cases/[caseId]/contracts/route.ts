import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

const statuses = new Set(["draft", "sent", "signed", "cancelled"]);
const statusesAfterContractReady = new Set(["contract_signed", "payment_confirmed", "paid", "in_progress", "traveling", "completed", "closed", "cancelled"]);
const statusesAfterContractSigned = new Set(["payment_confirmed", "paid", "in_progress", "traveling", "completed", "closed", "cancelled"]);

function hasBillingAddress(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object" && "address" in value) {
    return String((value as { address?: unknown }).address || "").trim().length > 0;
  }
  return false;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "draft");
  if (!statuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_contract_status" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const [actorId, settings] = await Promise.all([
    getRequestUserId(request),
    loadEffectiveSettings(organizationId),
  ]);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow } = await supabase
    .from("cases")
    .select("id,client_id,accepted_value,status,next_action")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  if (["sent", "signed"].includes(status)) {
    const { data: accepted } = await supabase.from("proposals").select("id,current_version_id").eq("case_id", caseId).eq("organization_id", organizationId).eq("status", "accepted").limit(1).maybeSingle();
    if (!accepted?.current_version_id || Number(caseRow.accepted_value || 0) <= 0) return NextResponse.json({ ok: false, error: "accepted_proposal_required" }, { status: 409 });

    const mustBlockMissingFiscal = settings.boolean("contracts.block_missing_fiscal", true) && settings.boolean("clients.fiscal.required", true);
    if (mustBlockMissingFiscal) {
      const { data: client } = await supabase
        .from("clients")
        .select("tax_id,billing_address")
        .eq("id", caseRow.client_id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      const fiscalComplete = Boolean(String(client?.tax_id || "").trim()) && hasBillingAddress(client?.billing_address);
      if (!fiscalComplete) return NextResponse.json({ ok: false, error: "client_fiscal_data_required" }, { status: 409 });
    }
  }

  const now = new Date().toISOString();
  const contractId = String(body?.id || "").trim();
  const payload = {
    organization_id: organizationId,
    case_id: caseId,
    title: String(body?.title || "Contrato de viaje").trim(),
    status,
    external_url: String(body?.external_url || "").trim() || null,
    signed_at: status === "signed" ? now : null,
    notes: String(body?.notes || "").trim() || null,
    updated_at: now,
  };
  const query = contractId ? supabase.from("contracts").update(payload).eq("id", contractId).eq("organization_id", organizationId).eq("case_id", caseId) : supabase.from("contracts").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  if (status === "sent" && !statusesAfterContractReady.has(String(caseRow.status || ""))) {
    await supabase.from("cases").update({ status: "contract_ready", next_action: "Obtener firma del contrato", updated_at: now }).eq("id", caseId).eq("organization_id", organizationId);
  }
  if (status === "signed") {
    if (!statusesAfterContractSigned.has(String(caseRow.status || ""))) {
      await supabase.from("cases").update({ status: "contract_signed", next_action: "Confirmar pago", updated_at: now }).eq("id", caseId).eq("organization_id", organizationId);
    }
    await supabase.from("tasks")
      .update({ status: "done", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("case_id", caseId)
      .eq("status", "pending")
      .eq("title", "Preparar contrato y solicitar documentación");
  }
  if (status === "cancelled") {
    await supabase.from("tasks")
      .update({ status: "cancelled", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("case_id", caseId)
      .eq("status", "pending")
      .eq("title", "Preparar contrato y solicitar documentación");
  }

  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: `contract.${status}`, title: status === "signed" ? "Contrato firmado" : `Contrato actualizado: ${status}`, payload: { contract_id: data.id }, created_by: actorId });
  return NextResponse.json({ ok: true, data });
}
