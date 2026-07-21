import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { sendTransactionalEmail } from "@/lib/smtp-email-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function one(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const db = getSupabaseAdminClient();
  const [{ data: caseRow, error: caseError }, { data: contracts, error: contractError }, { data: payments, error: paymentError }, { data: fiscalDocuments, error: fiscalError }, settings] = await Promise.all([
    db.from("cases").select("id,case_code,destination,accepted_value,currency,client_id,clients(display_name,email)").eq("id", caseId).eq("organization_id", access.organizationId).maybeSingle(),
    db.from("contracts").select("id,title,status,signed_at,external_url,current_version_id").eq("case_id", caseId).eq("organization_id", access.organizationId).eq("status", "signed").order("signed_at", { ascending: false }).limit(1),
    db.from("payments").select("amount,status").eq("case_id", caseId).eq("organization_id", access.organizationId),
    db.from("billing_documents").select("document_type,document_number,status").eq("case_id", caseId).eq("organization_id", access.organizationId).eq("status", "issued").order("created_at", { ascending: true }),
    loadEffectiveSettings(access.organizationId),
  ]);
  const firstError = caseError || contractError || paymentError || fiscalError;
  if (firstError) return NextResponse.json({ ok: false, error: firstError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  if (!contracts?.length) return NextResponse.json({ ok: false, error: "signed_contract_required" }, { status: 409 });
  const paid = (payments || []).filter((item) => ["confirmed", "paid", "received"].includes(String(item.status))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (paid <= 0 || paid + 0.01 < Number(caseRow.accepted_value || 0)) return NextResponse.json({ ok: false, error: "full_payment_required" }, { status: 409 });

  const generalConditionsUrl = settings.string("legal.general_conditions_url", "");
  const standardInformationUrl = settings.string("legal.standard_information_url", "");
  if (!generalConditionsUrl || !standardInformationUrl) return NextResponse.json({ ok: false, error: "legal_templates_incomplete" }, { status: 409 });

  const client = one(caseRow.clients);
  const recipientEmail = String(client?.email || "").trim().toLowerCase();
  if (!recipientEmail) return NextResponse.json({ ok: false, error: "client_email_required" }, { status: 409 });
  const signedContract = contracts[0];
  const contractUrl = String(signedContract.external_url || "").trim();
  if (!contractUrl) return NextResponse.json({ ok: false, error: "contract_delivery_link_required" }, { status: 409 });

  const { data: existing } = await db.from("timeline_events")
    .select("id,event_type,title,payload,created_at")
    .eq("organization_id", access.organizationId)
    .eq("case_id", caseId)
    .eq("event_type", "legal_pack.sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, data: existing, duplicate: true });

  const subject = `Documentación de tu viaje · ${caseRow.case_code}`;
  const fiscalSummary = (fiscalDocuments || []).map((document) => {
    const label = document.document_type === "final_invoice" ? "Factura final" : document.document_type === "proforma" ? "Proforma" : "Documento fiscal";
    return `• ${label}${document.document_number ? ` ${document.document_number}` : ""}: emitido`;
  });
  const body = [
    `Hola ${String(client?.display_name || "").trim()},`,
    "",
    `Tu viaje ${caseRow.destination ? `a ${caseRow.destination}` : caseRow.case_code} ya tiene firma y pago confirmados.`,
    "",
    `• Contrato firmado: ${contractUrl}`,
    `• Condiciones generales: ${generalConditionsUrl}`,
    `• Formulario de información normalizada: ${standardInformationUrl}`,
    ...fiscalSummary,
    "",
    "Conserva este correo junto con la documentación de tu viaje.",
    "",
    "Un saludo,",
    "Equipo Routsify",
  ].join("\n");
  const delivery = await sendTransactionalEmail({ organizationId: access.organizationId, to: recipientEmail, subject, body });
  if (!delivery.ok) return NextResponse.json({ ok: false, error: delivery.error, data: delivery }, { status: delivery.status });

  const now = new Date().toISOString();
  const { error: communicationError } = await db.from("communication_followups").upsert({
    organization_id: access.organizationId,
    case_id: caseId,
    client_id: caseRow.client_id,
    contract_id: signedContract.id,
    kind: "legal_pack",
    channel: "email",
    recipient_name: String(client?.display_name || "").trim() || null,
    recipient_email: recipientEmail,
    subject,
    body,
    status: "sent",
    due_at: now,
    sent_at: now,
    thread_key: `case:${caseId}:legal`,
    idempotency_key: `legal_pack:${caseId}`,
    metadata: { contract_url: contractUrl, general_conditions_url: generalConditionsUrl, standard_information_url: standardInformationUrl },
    provider: delivery.provider,
    provider_message_id: delivery.messageId,
    provider_status: "accepted",
    provider_error: null,
    failed_at: null,
    created_by: access.actorId,
    updated_at: now,
  }, { onConflict: "organization_id,idempotency_key" });
  if (communicationError) return NextResponse.json({ ok: false, error: communicationError.message, email_sent: true }, { status: 500 });

  const { data, error } = await db.from("timeline_events").insert({
    organization_id: access.organizationId,
    case_id: caseId,
    event_type: "legal_pack.sent",
    title: "Documentación legal enviada al cliente",
    payload: {
      contract_url: contractUrl,
      general_conditions_url: generalConditionsUrl,
      standard_information_url: standardInformationUrl,
      paid_total: paid,
      recipient_email: recipientEmail,
      provider: delivery.provider,
      provider_message_id: delivery.messageId,
    },
    created_by: access.actorId,
  }).select("id,event_type,title,payload,created_at").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data, duplicate: false, delivery: { provider: delivery.provider, status: "accepted" } }, { status: 201 });
}
