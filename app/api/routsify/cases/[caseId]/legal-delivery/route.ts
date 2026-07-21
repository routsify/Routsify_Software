import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const db = getSupabaseAdminClient();
  const [{ data: caseRow, error: caseError }, { data: contracts, error: contractError }, { data: payments, error: paymentError }, settings] = await Promise.all([
    db.from("cases").select("id,case_code,accepted_value,currency").eq("id", caseId).eq("organization_id", access.organizationId).maybeSingle(),
    db.from("contracts").select("id,status,signed_at").eq("case_id", caseId).eq("organization_id", access.organizationId).eq("status", "signed").limit(1),
    db.from("payments").select("amount,status").eq("case_id", caseId).eq("organization_id", access.organizationId),
    loadEffectiveSettings(access.organizationId),
  ]);
  const firstError = caseError || contractError || paymentError;
  if (firstError) return NextResponse.json({ ok: false, error: firstError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  if (!contracts?.length) return NextResponse.json({ ok: false, error: "signed_contract_required" }, { status: 409 });
  const paid = (payments || []).filter((item) => ["confirmed", "paid", "received"].includes(String(item.status))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (paid <= 0 || paid + 0.01 < Number(caseRow.accepted_value || 0)) return NextResponse.json({ ok: false, error: "full_payment_required" }, { status: 409 });

  const generalConditionsUrl = settings.string("legal.general_conditions_url", "");
  const standardInformationUrl = settings.string("legal.standard_information_url", "");
  if (!generalConditionsUrl || !standardInformationUrl) return NextResponse.json({ ok: false, error: "legal_templates_incomplete" }, { status: 409 });

  const { data: existing } = await db.from("timeline_events")
    .select("id,event_type,title,payload,created_at")
    .eq("organization_id", access.organizationId)
    .eq("case_id", caseId)
    .eq("event_type", "legal_pack.sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, data: existing, duplicate: true });

  const { data, error } = await db.from("timeline_events").insert({
    organization_id: access.organizationId,
    case_id: caseId,
    event_type: "legal_pack.sent",
    title: "Documentación legal enviada al cliente",
    payload: { general_conditions_url: generalConditionsUrl, standard_information_url: standardInformationUrl, paid_total: paid },
    created_by: access.actorId,
  }).select("id,event_type,title,payload,created_at").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data, duplicate: false }, { status: 201 });
}
