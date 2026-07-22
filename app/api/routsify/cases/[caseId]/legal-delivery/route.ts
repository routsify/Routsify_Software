import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { sendTransactionalEmail } from "@/lib/smtp-email-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { LEGAL_DOCUMENTS_BUCKET } from "@/lib/storage-server";

const MAX_LEGAL_PACK_BYTES = 20 * 1024 * 1024;

function one(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function snapshotDocumentIds(value: unknown) {
  const snapshot = one(value) || {};
  const documents = Array.isArray(snapshot.legal_documents) ? snapshot.legal_documents : [];
  return documents.map((item) => one(item)?.id).filter((id): id is string => typeof id === "string" && Boolean(id));
}

function documentTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    travel_contract: "Contrato de viaje",
    general_terms: "Condiciones generales",
    precontractual_information: "Información precontractual",
    privacy_policy: "Política de privacidad",
    other: "Documento legal",
  };
  return labels[String(value || "")] || "Documento legal";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { caseId } = await params;
  const db = getSupabaseAdminClient();
  const [{ data: caseRow, error: caseError }, { data: contracts, error: contractError }, { data: payments, error: paymentError }, { data: fiscalDocuments, error: fiscalError }] = await Promise.all([
    db.from("cases").select("id,case_code,destination,accepted_value,currency,client_id,clients(display_name,email)").eq("id", caseId).eq("organization_id", access.organizationId).maybeSingle(),
    db.from("contracts").select("id,title,status,signed_at,legal_document_id,current_version_id").eq("case_id", caseId).eq("organization_id", access.organizationId).eq("status", "signed").order("signed_at", { ascending: false }).limit(1),
    db.from("payments").select("amount,status").eq("case_id", caseId).eq("organization_id", access.organizationId),
    db.from("billing_documents").select("document_type,document_number,status").eq("case_id", caseId).eq("organization_id", access.organizationId).eq("status", "issued").order("created_at", { ascending: true }),
  ]);
  const firstError = caseError || contractError || paymentError || fiscalError;
  if (firstError) return NextResponse.json({ ok: false, error: firstError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  if (!contracts?.length) return NextResponse.json({ ok: false, error: "signed_contract_required" }, { status: 409 });
  const paid = (payments || []).filter((item) => ["confirmed", "paid", "received"].includes(String(item.status))).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (paid <= 0 || paid + 0.01 < Number(caseRow.accepted_value || 0)) return NextResponse.json({ ok: false, error: "full_payment_required" }, { status: 409 });

  const client = one(caseRow.clients);
  const recipientEmail = String(client?.email || "").trim().toLowerCase();
  if (!recipientEmail) return NextResponse.json({ ok: false, error: "client_email_required" }, { status: 409 });
  const signedContract = contracts[0];
  if (!signedContract.legal_document_id || !signedContract.current_version_id) return NextResponse.json({ ok: false, error: "contract_legal_pdf_required" }, { status: 409 });

  const { data: existing } = await db.from("timeline_events")
    .select("id,event_type,title,payload,created_at")
    .eq("organization_id", access.organizationId)
    .eq("case_id", caseId)
    .eq("event_type", "legal_pack.sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, data: existing, duplicate: true });

  const { data: contractVersion, error: versionError } = await db.from("contract_versions")
    .select("id,content_snapshot,legal_document_id")
    .eq("id", signedContract.current_version_id)
    .eq("contract_id", signedContract.id)
    .eq("organization_id", access.organizationId)
    .maybeSingle();
  if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 400 });
  if (!contractVersion) return NextResponse.json({ ok: false, error: "contract_version_not_found" }, { status: 409 });

  const orderedIds = [...new Set([signedContract.legal_document_id, ...snapshotDocumentIds(contractVersion.content_snapshot)])];
  const { data: legalDocuments, error: documentsError } = await db.from("legal_documents")
    .select("id,document_type,title,version_label,file_name,storage_bucket,storage_path,mime_type,size_bytes,checksum,status")
    .eq("organization_id", access.organizationId)
    .in("id", orderedIds);
  if (documentsError) return NextResponse.json({ ok: false, error: documentsError.message }, { status: 400 });
  const documentById = new Map((legalDocuments || []).map((item) => [item.id, item]));
  const selectedDocuments = orderedIds.map((id) => documentById.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!selectedDocuments.length || selectedDocuments[0]?.id !== signedContract.legal_document_id) return NextResponse.json({ ok: false, error: "contract_legal_pdf_not_found" }, { status: 409 });
  if (selectedDocuments.some((item) => item.storage_bucket !== LEGAL_DOCUMENTS_BUCKET || item.mime_type !== "application/pdf")) return NextResponse.json({ ok: false, error: "invalid_legal_pack_document" }, { status: 409 });
  const totalBytes = selectedDocuments.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
  if (totalBytes > MAX_LEGAL_PACK_BYTES) return NextResponse.json({ ok: false, error: "legal_pack_too_large" }, { status: 409 });

  const downloaded = await Promise.all(selectedDocuments.map(async (document) => {
    const { data, error } = await db.storage.from(LEGAL_DOCUMENTS_BUCKET).download(document.storage_path);
    if (error || !data) throw new Error(error?.message || `legal_document_download_failed:${document.id}`);
    return { document, content: Buffer.from(await data.arrayBuffer()) };
  })).catch((error: unknown) => error instanceof Error ? error : new Error("legal_document_download_failed"));
  if (downloaded instanceof Error) return NextResponse.json({ ok: false, error: downloaded.message }, { status: 424 });

  const subject = `Documentación de tu viaje · ${caseRow.case_code}`;
  const fiscalSummary = (fiscalDocuments || []).map((document) => {
    const label = document.document_type === "final_invoice" ? "Factura final" : document.document_type === "proforma" ? "Proforma" : "Documento fiscal";
    return `• ${label}${document.document_number ? ` ${document.document_number}` : ""}: emitido`;
  });
  const legalSummary = selectedDocuments.map((document) => `• ${documentTypeLabel(document.document_type)}: ${document.title} (${document.version_label})`);
  const body = [
    `Hola ${String(client?.display_name || "").trim()},`,
    "",
    `Tu viaje ${caseRow.destination ? `a ${caseRow.destination}` : caseRow.case_code} ya tiene firma y pago confirmados. Adjuntamos la documentación legal correspondiente:`,
    "",
    ...legalSummary,
    ...fiscalSummary,
    "",
    "Conserva este correo y sus archivos adjuntos junto con la documentación de tu viaje.",
    "",
    "Un saludo,",
    "Equipo Routsify",
  ].join("\n");
  const delivery = await sendTransactionalEmail({
    organizationId: access.organizationId,
    to: recipientEmail,
    subject,
    body,
    attachments: downloaded.map(({ document, content }) => ({ fileName: document.file_name, content, contentType: "application/pdf" })),
  });
  if (!delivery.ok) return NextResponse.json({ ok: false, error: delivery.error, data: delivery }, { status: delivery.status });

  const now = new Date().toISOString();
  const legalMetadata = selectedDocuments.map((document) => ({ id: document.id, document_type: document.document_type, title: document.title, version_label: document.version_label, file_name: document.file_name, checksum: document.checksum }));
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
    metadata: { legal_documents: legalMetadata, contract_version_id: contractVersion.id },
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
    payload: { legal_documents: legalMetadata, contract_version_id: contractVersion.id, paid_total: paid, recipient_email: recipientEmail, provider: delivery.provider, provider_message_id: delivery.messageId },
    created_by: access.actorId,
  }).select("id,event_type,title,payload,created_at").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data, duplicate: false, attachments: selectedDocuments.length, delivery: { provider: delivery.provider, status: "accepted" } }, { status: 201 });
}
