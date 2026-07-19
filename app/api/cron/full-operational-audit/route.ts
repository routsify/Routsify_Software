import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createConfiguredCase } from "@/lib/case-creation-server";
import { testFilloutConnection } from "@/lib/fillout-api-server";
import { testHoldedModules } from "@/lib/holded-server";
import { testOpenAIConnection } from "@/lib/openai-ocr-server";
import { createProposalToken, hashProposalToken } from "@/lib/proposal-token";
import { resolvePublicProposal } from "@/lib/proposal-public-server";
import { testRoutsifyBookingApi } from "@/lib/routsify-booking-api-server";
import { addBudgetLineRepository, confirmDocumentUploadRepository, createProposalRepository } from "@/lib/server-repositories";
import { testSmtpConnection } from "@/lib/smtp-email-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "69d26bb0c3b234abe58a82df2618025d493ff5ff6e75391654f3490675eabc88";
const TEST_PREFIX = "AUDIT-E2E";

type JsonRow = Record<string, unknown>;
type AuditCheck = {
  name: string;
  ok: boolean;
  durationMs: number;
  details?: unknown;
  error?: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function row(value: unknown): JsonRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRow : {};
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  return Boolean(token && safeEqual(createHash("sha256").update(token).digest("hex"), TOKEN_HASH));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, operation: () => Promise<unknown>): Promise<AuditCheck> {
  const started = Date.now();
  try {
    const details = await operation();
    return { name, ok: true, durationMs: Date.now() - started, details };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : "audit_check_failed",
    };
  }
}

function resultData(result: unknown) {
  const value = row(result);
  assert(value.ok === true, text(value.error) || "repository_operation_failed");
  return row(value.data);
}

async function runIntegrationAudit(organizationId: string) {
  const checks: AuditCheck[] = [];
  checks.push(await check("Holded · autenticación y lectura de módulos", async () => {
    const result = await testHoldedModules(organizationId);
    assert(result.ok, "holded_connection_failed");
    assert(result.missingReadScopes.length === 0, `holded_missing_scopes:${result.missingReadScopes.join(",")}`);
    assert(result.availableModules.length === Object.keys(result.modules).length, "holded_modules_incomplete");
    return {
      apiVersion: result.apiVersion,
      authenticated: result.authenticated,
      availableModules: result.availableModules,
      missingReadScopes: result.missingReadScopes,
      modules: Object.fromEntries(Object.entries(result.modules).map(([name, module]) => [name, { ok: module.ok, status: module.status, permissionGranted: module.permissionGranted }])),
    };
  }));
  checks.push(await check("Fillout · formulario y respuestas", async () => {
    const result = await testFilloutConnection(organizationId);
    assert(result.ok, result.error || "fillout_connection_failed");
    return result;
  }));
  checks.push(await check("Routsify Booking · disponibilidad API", async () => {
    const result = await testRoutsifyBookingApi(organizationId);
    assert(result.ok, result.error || "booking_connection_failed");
    return result;
  }));
  checks.push(await check("Hostinger SMTP · conexión autenticada", async () => {
    const result = await testSmtpConnection(organizationId);
    assert(result.ok, result.error || "smtp_connection_failed");
    return { ok: result.ok, status: result.status, host: result.host, port: result.port, fromAddress: result.fromAddress };
  }));
  checks.push(await check("OpenAI · autenticación y modelo OCR", async () => {
    const result = await testOpenAIConnection(organizationId);
    assert(result.ok, result.error || "openai_connection_failed");
    return result;
  }));
  checks.push({ name: "WhatsApp Business · standby", ok: true, durationMs: 0, details: { skipped: true, reason: "pending_credentials_by_user_decision" } });
  return checks;
}

async function cleanupAuditData(input: {
  organizationId: string;
  runId: string;
  clientId?: string;
  leadId?: string;
  bookingId?: string;
  caseId?: string;
  documentId?: string;
  followupId?: string;
  storagePath?: string;
}) {
  const db = getSupabaseAdminClient();
  const cleanup: Array<{ target: string; ok: boolean; error?: string }> = [];
  async function remove(target: string, operation: () => PromiseLike<{ error: { message?: string } | null }>) {
    try {
      const { error } = await operation();
      cleanup.push(error ? { target, ok: false, error: error.message || "delete_failed" } : { target, ok: true });
    } catch (error) {
      cleanup.push({ target, ok: false, error: error instanceof Error ? error.message : "delete_failed" });
    }
  }

  if (input.storagePath) {
    const result = await db.storage.from("case-documents").remove([input.storagePath]);
    cleanup.push(result.error ? { target: "storage", ok: false, error: result.error.message } : { target: "storage", ok: true });
  }
  if (input.documentId) await remove("document", () => db.from("documents").delete().eq("id", input.documentId!));
  if (input.followupId) await remove("communication_followup", () => db.from("communication_followups").delete().eq("id", input.followupId!));
  if (input.caseId) {
    await remove("test_tasks", () => db.from("tasks").delete().eq("case_id", input.caseId!));
    await remove("test_timeline", () => db.from("timeline_events").delete().eq("case_id", input.caseId!));
    await remove("test_audit_log", () => db.from("audit_log").delete().eq("entity_id", input.caseId!));
    await remove("case_cascade", () => db.from("cases").delete().eq("id", input.caseId!));
  }
  if (input.bookingId) await remove("booking", () => db.from("bookings").delete().eq("id", input.bookingId!));
  if (input.leadId) await remove("lead", () => db.from("leads").delete().eq("id", input.leadId!));
  if (input.clientId) {
    await remove("client_tasks", () => db.from("tasks").delete().eq("client_id", input.clientId!));
    await remove("client_timeline", () => db.from("timeline_events").delete().eq("client_id", input.clientId!));
    await remove("client_audit_log", () => db.from("audit_log").delete().eq("entity_id", input.clientId!));
    await remove("client", () => db.from("clients").delete().eq("id", input.clientId!));
  }
  await remove("run_followups", () => db.from("communication_followups").delete().contains("metadata", { audit_run_id: input.runId }));
  return cleanup;
}

async function runOperationalAudit(organizationId: string, actorId: string) {
  const db = getSupabaseAdminClient();
  const runId = randomUUID();
  const email = `audit.${runId}@example.invalid`;
  const phone = `+3499${Date.now().toString().slice(-7)}`;
  const ids: {
    clientId?: string;
    leadId?: string;
    bookingId?: string;
    caseId?: string;
    documentId?: string;
    followupId?: string;
    storagePath?: string;
  } = {};
  const checks: AuditCheck[] = [];

  try {
    checks.push(await check("Cliente · creación, normalización y duplicado", async () => {
      const { data: client, error } = await db.from("clients").insert({
        organization_id: organizationId,
        client_type: "person",
        display_name: `${TEST_PREFIX} ${runId.slice(0, 8)}`,
        first_name: "Auditoría",
        last_name: "Operativa",
        email,
        email_normalized: email,
        phone,
        phone_normalized: phone.replace(/\D/g, ""),
        country: "ES",
        language: "es",
        source: "operational_audit",
        notes: `Temporary audit ${runId}`,
      }).select("id,display_name,email,phone,source").single();
      if (error) throw new Error(error.message);
      ids.clientId = client.id;
      const duplicate = await db.from("clients").insert({ organization_id: organizationId, display_name: "Duplicate audit", email, email_normalized: email, source: "operational_audit" });
      assert(duplicate.error?.code === "23505", "duplicate_client_email_not_blocked");
      return { id: client.id, normalized: true, duplicateBlocked: true };
    }));
    assert(ids.clientId, "audit_client_not_created");

    checks.push(await check("Solicitud · creación e idempotencia", async () => {
      const submissionId = `audit-${runId}`;
      const { data: lead, error } = await db.from("leads").insert({
        organization_id: organizationId,
        client_id: ids.clientId,
        source: "operational_audit",
        source_submission_id: submissionId,
        status: "qualified",
        client_name: `${TEST_PREFIX} Cliente`,
        email,
        email_normalized: email,
        phone,
        phone_normalized: phone.replace(/\D/g, ""),
        destination: "Italia",
        travel_start: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
        travel_end: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
        travelers: 2,
        budget_hint: "2500 EUR",
        payload_redacted: { audit_run_id: runId },
      }).select("id,status,destination").single();
      if (error) throw new Error(error.message);
      ids.leadId = lead.id;
      const duplicate = await db.from("leads").insert({ organization_id: organizationId, client_id: ids.clientId, source: "operational_audit", source_submission_id: submissionId, status: "qualified" });
      assert(duplicate.error?.code === "23505", "duplicate_lead_not_blocked");
      return { id: lead.id, duplicateBlocked: true };
    }));
    assert(ids.leadId, "audit_lead_not_created");

    checks.push(await check("Booking · relación con cliente y solicitud sin expediente automático", async () => {
      const { data: booking, error } = await db.from("bookings").insert({
        organization_id: organizationId,
        client_id: ids.clientId,
        lead_id: ids.leadId,
        external_booking_id: `audit-booking-${runId}`,
        external_id: `audit-booking-${runId}`,
        event_type: "consultation",
        starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
        ends_at: new Date(Date.now() + 3 * 86400000 + 30 * 60000).toISOString(),
        status: "confirmed",
        source: "operational_audit",
        payload: { audit_run_id: runId },
      }).select("id,client_id,lead_id,status").single();
      if (error) throw new Error(error.message);
      ids.bookingId = booking.id;
      const { count } = await db.from("cases").select("id", { count: "exact", head: true }).eq("lead_id", ids.leadId!);
      assert((count || 0) === 0, "booking_created_case_automatically");
      return { id: booking.id, caseCreatedAutomatically: false };
    }));

    checks.push(await check("Expediente · creación manual, moneda y fechas", async () => {
      const result = await createConfiguredCase({
        organizationId,
        clientId: ids.clientId!,
        destination: "Italia",
        title: `${TEST_PREFIX} Italia ${runId.slice(0, 8)}`,
        tripStart: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
        tripEnd: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
        finalNotes: `Temporary audit ${runId}`,
        requestedCurrency: "EUR",
      });
      const data = resultData(result);
      ids.caseId = text(data.id);
      assert(ids.caseId, "case_id_missing");
      const { error: linkError } = await db.from("cases").update({ lead_id: ids.leadId, responsible_user_id: actorId, priority: "normal" }).eq("id", ids.caseId);
      if (linkError) throw new Error(linkError.message);
      return { id: ids.caseId, caseCode: data.case_code, currency: data.currency, createdManually: true };
    }));
    assert(ids.caseId, "audit_case_not_created");

    let proposalId = "";
    let versionId = "";
    checks.push(await check("Presupuesto · versión inicial y líneas económicas", async () => {
      const proposal = resultData(await createProposalRepository({ organization_id: organizationId, case_id: ids.caseId!, status: "draft" }));
      proposalId = text(proposal.id);
      assert(proposalId, "proposal_id_missing");
      const { data: version, error: versionError } = await db.from("proposal_versions").select("id").eq("proposal_id", proposalId).order("version_number", { ascending: false }).limit(1).single();
      if (versionError) throw new Error(versionError.message);
      versionId = version.id;
      const { data: supplier } = await db.from("suppliers").select("id,name").eq("organization_id", organizationId).eq("active", true).order("name").limit(1).maybeSingle();
      const first = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Asesoría y planificación", service_type_code: "service_fee", cost_budget: 100, margin_applied: 20, sale_price: 125, creates_expected_purchase: false });
      assert(first.ok, first.ok ? "" : first.error);
      const second = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Alojamiento de prueba", service_type_code: "hotel", supplier_id: supplier?.id || null, supplier_name: supplier?.name || "Proveedor auditoría", cost_budget: 1000, margin_applied: 20, sale_price: 1250, creates_expected_purchase: true });
      assert(second.ok, second.ok ? "" : second.error);
      const { data: totals, error: totalsError } = await db.from("proposal_versions").select("total_sale,total_cost_budget,budgeted_profit").eq("id", versionId).single();
      if (totalsError) throw new Error(totalsError.message);
      assert(Math.abs(Number(totals.total_sale) - 1375) < 0.01, `unexpected_total_sale:${totals.total_sale}`);
      assert(Math.abs(Number(totals.total_cost_budget) - 1100) < 0.01, `unexpected_total_cost:${totals.total_cost_budget}`);
      return { proposalId, versionId, totals, supplierLinked: Boolean(supplier?.id) };
    }));
    assert(proposalId && versionId, "audit_proposal_not_created");

    let publicToken = "";
    checks.push(await check("Propuesta pública · token, caducidad y resolución", async () => {
      const expiresAt = new Date(Date.now() + 2 * 86400000);
      publicToken = createProposalToken({ proposalId, versionId, expiresAt });
      const tokenHash = hashProposalToken(publicToken);
      const now = new Date().toISOString();
      const versionUpdate = await db.from("proposal_versions").update({ status: "sent", expires_at: expiresAt.toISOString(), snapshot: { audit_run_id: runId } }).eq("id", versionId);
      if (versionUpdate.error) throw new Error(versionUpdate.error.message);
      const proposalUpdate = await db.from("proposals").update({ status: "sent", current_version_id: versionId, public_token_hash: tokenHash, public_token_expires_at: expiresAt.toISOString(), updated_at: now }).eq("id", proposalId);
      if (proposalUpdate.error) throw new Error(proposalUpdate.error.message);
      await db.from("cases").update({ status: "proposal_sent", next_action: "Seguimiento de auditoría" }).eq("id", ids.caseId!);
      const resolved = await resolvePublicProposal(publicToken);
      assert(resolved.ok, resolved.ok ? "" : `proposal_token_${resolved.reason}`);
      assert(resolved.proposalId === proposalId && resolved.versionId === versionId, "proposal_token_resolved_wrong_entity");
      return { resolved: true, expiresAt: expiresAt.toISOString() };
    }));

    checks.push(await check("Aceptación · bloqueo de versión, evidencia e idempotencia", async () => {
      const accepted = await db.rpc("accept_proposal_version", { target_version: versionId });
      if (accepted.error) throw new Error(accepted.error.message);
      const acceptancePayload = {
        organization_id: organizationId,
        proposal_id: proposalId,
        proposal_version_id: versionId,
        case_id: ids.caseId,
        acceptor_name: "Cliente Auditoría",
        acceptor_email: email,
        terms_accepted: true,
        ip_hash: createHash("sha256").update("audit").digest("hex"),
        user_agent: "Routsify operational audit",
        accepted_at: new Date().toISOString(),
      };
      const acceptance = await db.from("proposal_acceptances").insert(acceptancePayload).select("id").single();
      if (acceptance.error) throw new Error(acceptance.error.message);
      const duplicate = await db.from("proposal_acceptances").insert(acceptancePayload);
      assert(duplicate.error?.code === "23505", "duplicate_acceptance_not_blocked");
      const { data: locked } = await db.from("proposal_versions").select("status,locked,accepted_at").eq("id", versionId).single();
      assert(locked?.status === "accepted" || locked?.locked === true, "accepted_version_not_locked");
      const { count: purchaseCount } = await db.from("expected_purchases").select("id", { count: "exact", head: true }).eq("case_id", ids.caseId!);
      assert((purchaseCount || 0) >= 1, "expected_purchase_not_generated");
      return { duplicateBlocked: true, versionLocked: true, expectedPurchases: purchaseCount || 0 };
    }));

    let contractId = "";
    let contractVersionId = "";
    checks.push(await check("Contrato · versionado y firma con evidencia", async () => {
      const created = await db.rpc("create_contract_version", {
        target_org: organizationId,
        target_case: ids.caseId,
        contract_title: `${TEST_PREFIX} Contrato`,
        legal_version_value: "audit-v1",
        external_url_value: null,
        notes_value: `Temporary audit ${runId}`,
        contract_status_value: "draft",
        actor: actorId,
      });
      if (created.error) throw new Error(created.error.message);
      const { data: contract, error: contractError } = await db.from("contracts").select("id,current_version_id,status").eq("case_id", ids.caseId!).limit(1).single();
      if (contractError) throw new Error(contractError.message);
      contractId = contract.id;
      contractVersionId = text(contract.current_version_id);
      assert(contractVersionId, "contract_version_missing");
      const signed = await db.rpc("record_contract_signature", {
        target_org: organizationId,
        target_contract: contractId,
        signer_name_value: "Cliente Auditoría",
        signer_email_value: email,
        ip_hash_value: createHash("sha256").update("audit-contract").digest("hex"),
        user_agent_value: "Routsify operational audit",
        evidence_value: { audit_run_id: runId, consent: true },
        review_confirmed: true,
        actor: actorId,
      });
      if (signed.error) throw new Error(signed.error.message);
      const { data: signedContract } = await db.from("contracts").select("status,signed_at").eq("id", contractId).single();
      const { count: evidenceCount } = await db.from("signature_evidence").select("id", { count: "exact", head: true }).eq("contract_id", contractId);
      assert(signedContract?.status === "signed" && Boolean(signedContract.signed_at), "contract_not_signed");
      assert((evidenceCount || 0) === 1, "signature_evidence_missing");
      return { contractId, contractVersionId, signed: true, evidenceCount };
    }));

    checks.push(await check("Viajeros · alta y revisión documental", async () => {
      const { data: traveler, error } = await db.from("travelers").insert({
        organization_id: organizationId,
        case_id: ids.caseId,
        traveler_type: "adult",
        first_name: "Viajero",
        last_name: "Auditoría",
        birth_date: "1990-01-01",
        nationality: "ES",
        document_type: "passport",
        document_country: "ES",
        issuing_country: "ES",
        document_number: `AUD${runId.slice(0, 8)}`,
        document_expires_at: "2030-01-01",
        review_status: "approved",
        ocr_status: "reviewed",
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
      }).select("id,review_status").single();
      if (error) throw new Error(error.message);
      return { id: traveler.id, reviewStatus: traveler.review_status };
    }));

    checks.push(await check("Documentos · almacenamiento privado, URL firmada y registro", async () => {
      const storagePath = `${organizationId}/audit/${runId}/sample.png`;
      ids.storagePath = storagePath;
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
      const upload = await db.storage.from("case-documents").upload(storagePath, png, { contentType: "image/png", upsert: false });
      if (upload.error) throw new Error(upload.error.message);
      const signed = await db.storage.from("case-documents").createSignedUrl(storagePath, 60);
      if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "signed_url_missing");
      const downloaded = await db.storage.from("case-documents").download(storagePath);
      if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message || "storage_download_failed");
      const recordResult = await confirmDocumentUploadRepository({ organizationId, caseId: ids.caseId, ownerType: "case", ownerId: ids.caseId, title: `${TEST_PREFIX} Documento`, type: "passport_copy", bucket: "case-documents", storagePath, fileName: "sample.png", mimeType: "image/png", sizeBytes: png.length, checksum: createHash("sha256").update(png).digest("hex"), sensitivity: "private", retentionDays: 1, actorId });
      const document = resultData(recordResult);
      ids.documentId = text(document.id);
      await db.from("documents").update({ status: "approved", scan_status: "clean", ocr_status: "reviewed" }).eq("id", ids.documentId!);
      return { documentId: ids.documentId, privateBucket: true, signedUrlCreated: true, bytesDownloaded: downloaded.data.size };
    }));

    checks.push(await check("Pagos · confirmación externa e idempotencia", async () => {
      const paymentReference = `AUDIT-PAY-${runId}`;
      const transactionId = `AUDIT-TX-${runId}`;
      const input = {
        target_org: organizationId,
        target_case: ids.caseId,
        transaction_value: transactionId,
        payment_reference_value: paymentReference,
        amount_value: 1375,
        currency_value: "EUR",
        provider_value: "operational_audit",
        confirmed_timestamp: new Date().toISOString(),
        payment_payload: { audit_run_id: runId },
      };
      const first = await db.rpc("confirm_external_payment", input);
      if (first.error) throw new Error(first.error.message);
      const second = await db.rpc("confirm_external_payment", input);
      if (second.error) throw new Error(second.error.message);
      const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("payment_reference", paymentReference);
      assert((count || 0) === 1, `payment_idempotency_failed:${count}`);
      return { confirmed: true, idempotent: true, records: count };
    }));

    checks.push(await check("Comunicaciones · seguimiento preparado sin envío real", async () => {
      const { data: followup, error } = await db.from("communication_followups").insert({
        organization_id: organizationId,
        case_id: ids.caseId,
        client_id: ids.clientId,
        proposal_id: proposalId,
        contract_id: contractId,
        kind: "audit_followup",
        channel: "email",
        recipient_name: "Cliente Auditoría",
        recipient_email: email,
        subject: `${TEST_PREFIX} Seguimiento`,
        body: "Mensaje temporal de auditoría. No enviar.",
        status: "prepared",
        due_at: new Date(Date.now() + 86400000).toISOString(),
        sequence_step: 1,
        idempotency_key: `audit-followup:${runId}`,
        metadata: { audit_run_id: runId, do_not_send: true },
        created_by: actorId,
      }).select("id,status").single();
      if (error) throw new Error(error.message);
      ids.followupId = followup.id;
      const duplicate = await db.from("communication_followups").insert({ organization_id: organizationId, kind: "audit_followup", channel: "email", status: "prepared", sequence_step: 1, idempotency_key: `audit-followup:${runId}` });
      assert(duplicate.error?.code === "23505", "followup_idempotency_failed");
      return { id: followup.id, prepared: true, duplicateBlocked: true, sent: false };
    }));

    checks.push(await check("Tareas y cronología · trazabilidad de expediente", async () => {
      const task = await db.from("tasks").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, title: `${TEST_PREFIX} Tarea`, status: "pending", priority: "normal", due_at: new Date(Date.now() + 86400000).toISOString(), assigned_to: actorId, payload: { audit_run_id: runId }, idempotency_key: `audit-task:${runId}` }).select("id").single();
      if (task.error) throw new Error(task.error.message);
      const timeline = await db.from("timeline_events").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, event_type: "audit.completed_step", title: `${TEST_PREFIX} Evento`, payload: { audit_run_id: runId }, created_by: actorId }).select("id").single();
      if (timeline.error) throw new Error(timeline.error.message);
      const { count: taskCount } = await db.from("tasks").select("id", { count: "exact", head: true }).eq("case_id", ids.caseId!);
      const { count: timelineCount } = await db.from("timeline_events").select("id", { count: "exact", head: true }).eq("case_id", ids.caseId!);
      assert((taskCount || 0) >= 1 && (timelineCount || 0) >= 1, "case_traceability_missing");
      return { taskCount, timelineCount };
    }));

    checks.push(await check("Compras · generación, control y resolución", async () => {
      const { data: purchases, error } = await db.from("expected_purchases").select("id,status,required,active,expected_amount,currency").eq("case_id", ids.caseId!);
      if (error) throw new Error(error.message);
      assert((purchases || []).length >= 1, "no_expected_purchases");
      const purchaseIds = (purchases || []).map((item) => item.id);
      const updated = await db.from("expected_purchases").update({ status: "not_required", required: false, active: false, not_required_reason: "Auditoría temporal", not_required_at: new Date().toISOString(), not_required_by: actorId }).in("id", purchaseIds);
      if (updated.error) throw new Error(updated.error.message);
      const { count: unresolved } = await db.from("expected_purchases").select("id", { count: "exact", head: true }).eq("case_id", ids.caseId!).eq("active", true).neq("status", "approved").neq("status", "not_required");
      assert((unresolved || 0) === 0, "purchases_not_resolved");
      return { generated: purchases.length, resolved: purchases.length };
    }));

    checks.push(await check("Cierre operativo · preflight y cierre controlado", async () => {
      await db.from("tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("case_id", ids.caseId!);
      await db.from("cases").update({ status: "post_trip", next_action: "Cerrar expediente", blocker: null }).eq("id", ids.caseId!);
      const preflight = await db.rpc("operational_close_preflight", { target_case: ids.caseId });
      if (preflight.error) throw new Error(preflight.error.message);
      const before = row(preflight.data);
      const close = await db.rpc("close_operational_case", { target_case: ids.caseId, actor: actorId });
      if (close.error) throw new Error(close.error.message);
      const after = row(close.data);
      const { data: closedCase } = await db.from("cases").select("status,operational_closed_at,close_blockers").eq("id", ids.caseId!).single();
      assert(Boolean(closedCase?.operational_closed_at), `case_not_operationally_closed:${JSON.stringify(after)}`);
      return { preflight: before, closeResult: after, status: closedCase.status, operationalClosed: true };
    }));

    checks.push(await check("Consultas de gestión · Cliente 360, Hoy, Control e informes base", async () => {
      const [clientResult, caseResult, proposalResult, purchaseResult, taskResult, timelineResult] = await Promise.all([
        db.from("clients").select("id,display_name,email,phone").eq("id", ids.clientId!).single(),
        db.from("cases").select("id,case_code,status,accepted_value,currency").eq("id", ids.caseId!).single(),
        db.from("proposals").select("id,status,current_version_id").eq("id", proposalId).single(),
        db.from("expected_purchases").select("id,status,expected_amount,approved_cost").eq("case_id", ids.caseId!),
        db.from("tasks").select("id,status,priority,due_at").eq("case_id", ids.caseId!),
        db.from("timeline_events").select("id,event_type,title,created_at").eq("case_id", ids.caseId!),
      ]);
      for (const result of [clientResult, caseResult, proposalResult, purchaseResult, taskResult, timelineResult]) if (result.error) throw new Error(result.error.message);
      return {
        client360Available: Boolean(clientResult.data),
        caseAvailable: Boolean(caseResult.data),
        proposalAvailable: Boolean(proposalResult.data),
        purchaseRows: purchaseResult.data?.length || 0,
        taskRows: taskResult.data?.length || 0,
        timelineRows: timelineResult.data?.length || 0,
      };
    }));
  } finally {
    const cleanup = await cleanupAuditData({ organizationId, runId, ...ids });
    checks.push({ name: "Limpieza de datos temporales", ok: cleanup.every((item) => item.ok), durationMs: 0, details: cleanup });
  }

  const cleanupVerification = await check("Verificación de limpieza", async () => {
    const [clients, leads, bookings, cases, followups] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("source", "operational_audit").ilike("notes", `%${runId}%`),
      db.from("leads").select("id", { count: "exact", head: true }).eq("source_submission_id", `audit-${runId}`),
      db.from("bookings").select("id", { count: "exact", head: true }).eq("external_booking_id", `audit-booking-${runId}`),
      db.from("cases").select("id", { count: "exact", head: true }).ilike("final_notes", `%${runId}%`),
      db.from("communication_followups").select("id", { count: "exact", head: true }).contains("metadata", { audit_run_id: runId }),
    ]);
    for (const result of [clients, leads, bookings, cases, followups]) if (result.error) throw new Error(result.error.message);
    const remaining = (clients.count || 0) + (leads.count || 0) + (bookings.count || 0) + (cases.count || 0) + (followups.count || 0);
    assert(remaining === 0, `temporary_data_remaining:${remaining}`);
    return { remaining: 0 };
  });
  checks.push(cleanupVerification);
  return { runId, checks };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const phase = text(row(body).phase || "all");
  const db = getSupabaseAdminClient();
  const { data: organization, error: orgError } = await db.from("organizations").select("id,name").order("created_at").limit(1).single();
  if (orgError || !organization) return NextResponse.json({ ok: false, error: orgError?.message || "organization_not_found" }, { status: 500 });
  const { data: profile, error: profileError } = await db.from("profiles").select("user_id,role").eq("organization_id", organization.id).eq("role", "admin").limit(1).single();
  if (profileError || !profile) return NextResponse.json({ ok: false, error: profileError?.message || "admin_profile_not_found" }, { status: 500 });

  const startedAt = new Date().toISOString();
  const integrationChecks = phase === "operations" ? [] : await runIntegrationAudit(organization.id);
  const operations = phase === "integrations" ? null : await runOperationalAudit(organization.id, profile.user_id);
  const checks = [...integrationChecks, ...(operations?.checks || [])];
  const failed = checks.filter((item) => !item.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    phase,
    startedAt,
    finishedAt: new Date().toISOString(),
    organization: { id: organization.id, name: organization.name },
    summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
    integrationChecks,
    operationalRunId: operations?.runId || null,
    operationalChecks: operations?.checks || [],
  }, { status: failed.length ? 207 : 200 });
}
