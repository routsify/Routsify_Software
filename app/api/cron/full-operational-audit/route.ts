import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createConfiguredCase } from "@/lib/case-creation-server";
import { testFilloutConnection } from "@/lib/fillout-api-server";
import { testHoldedModules } from "@/lib/holded-server";
import { testOpenAIConnection } from "@/lib/openai-ocr-server";
import { createProposalToken, hashProposalToken } from "@/lib/proposal-token";
import { resolvePublicProposal } from "@/lib/proposal-public-server";
import { testRoutsifyBookingApi } from "@/lib/routsify-booking-api-server";
import { addBudgetLineRepository, createProposalRepository } from "@/lib/server-repositories";
import { testSmtpConnection } from "@/lib/smtp-email-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "69d26bb0c3b234abe58a82df2618025d493ff5ff6e75391654f3490675eabc88";

type JsonRow = Record<string, unknown>;
type AuditCheck = { name: string; ok: boolean; durationMs: number; details?: unknown; error?: string };

function text(value: unknown) { return String(value ?? "").trim(); }
function row(value: unknown): JsonRow { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRow : {}; }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function safeEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
function authorized(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  const token = value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
  return Boolean(token && safeEqual(createHash("sha256").update(token).digest("hex"), TOKEN_HASH));
}
async function runCheck(name: string, fn: () => Promise<unknown>): Promise<AuditCheck> {
  const started = Date.now();
  try { return { name, ok: true, durationMs: Date.now() - started, details: await fn() }; }
  catch (error) { return { name, ok: false, durationMs: Date.now() - started, error: error instanceof Error ? error.message : "audit_failed" }; }
}
function repositoryData(result: unknown) {
  const value = row(result);
  assert(value.ok === true, text(value.error) || "repository_failed");
  return row(value.data);
}

async function integrationChecks(organizationId: string): Promise<AuditCheck[]> {
  return [
    await runCheck("Holded · lectura de todos los módulos", async () => {
      const result = await testHoldedModules(organizationId);
      assert(result.ok && result.missingReadScopes.length === 0, "holded_not_fully_ready");
      assert(result.availableModules.length === Object.keys(result.modules).length, "holded_modules_incomplete");
      return { apiVersion: result.apiVersion, availableModules: result.availableModules, missingReadScopes: result.missingReadScopes };
    }),
    await runCheck("Fillout · formulario y respuestas", async () => {
      const result = await testFilloutConnection(organizationId);
      assert(result.ok, result.error || "fillout_failed");
      return result;
    }),
    await runCheck("Booking · disponibilidad API", async () => {
      const result = await testRoutsifyBookingApi(organizationId);
      assert(result.ok, result.error || "booking_failed");
      return result;
    }),
    await runCheck("SMTP · conexión autenticada", async () => {
      const result = await testSmtpConnection(organizationId);
      assert(result.ok, result.error || "smtp_failed");
      return { ok: true, status: result.status, host: result.host, port: result.port, fromAddress: result.fromAddress };
    }),
    await runCheck("OpenAI · autenticación OCR", async () => {
      const result = await testOpenAIConnection(organizationId);
      assert(result.ok, result.error || "openai_failed");
      return result;
    }),
    { name: "WhatsApp Business · standby", ok: true, durationMs: 0, details: { skipped: true, reason: "pending_credentials" } },
  ];
}

async function operationalChecks(organizationId: string, actorId: string) {
  const db = getSupabaseAdminClient();
  const runId = randomUUID();
  const email = `audit.${runId}@example.invalid`;
  const phone = `+3499${Date.now().toString().slice(-7)}`;
  const checks: AuditCheck[] = [];
  const ids: JsonRow = {};
  let storagePath = "";

  try {
    checks.push(await runCheck("Cliente · alta y duplicado", async () => {
      const created = await db.from("clients").insert({ organization_id: organizationId, client_type: "person", display_name: `AUDIT ${runId.slice(0, 8)}`, first_name: "Auditoría", last_name: "Operativa", email, email_normalized: email, phone, phone_normalized: phone.replace(/\D/g, ""), country: "ES", language: "es", source: "operational_audit", notes: runId }).select("id").single();
      if (created.error) throw new Error(created.error.message);
      ids.clientId = created.data.id;
      const duplicate = await db.from("clients").insert({ organization_id: organizationId, display_name: "AUDIT DUP", email, email_normalized: email });
      assert(duplicate.error?.code === "23505", "duplicate_email_not_blocked");
      return { created: true, duplicateBlocked: true };
    }));

    checks.push(await runCheck("Solicitud · alta e idempotencia", async () => {
      const sourceId = `audit-${runId}`;
      const created = await db.from("leads").insert({ organization_id: organizationId, client_id: ids.clientId, source: "operational_audit", source_submission_id: sourceId, status: "qualified", client_name: "Cliente Auditoría", email, email_normalized: email, phone, phone_normalized: phone.replace(/\D/g, ""), destination: "Italia", travel_start: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), travel_end: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), travelers: 2, budget_hint: "2500 EUR", payload_redacted: { audit_run_id: runId } }).select("id").single();
      if (created.error) throw new Error(created.error.message);
      ids.leadId = created.data.id;
      const duplicate = await db.from("leads").insert({ organization_id: organizationId, source: "operational_audit", source_submission_id: sourceId, status: "qualified" });
      assert(duplicate.error?.code === "23505", "duplicate_submission_not_blocked");
      return { created: true, duplicateBlocked: true };
    }));

    checks.push(await runCheck("Booking · cliente y lead sin expediente automático", async () => {
      const created = await db.from("bookings").insert({ organization_id: organizationId, client_id: ids.clientId, lead_id: ids.leadId, external_booking_id: `audit-${runId}`, external_id: `audit-${runId}`, event_type: "consultation", starts_at: new Date(Date.now() + 3 * 86400000).toISOString(), ends_at: new Date(Date.now() + 3 * 86400000 + 30 * 60000).toISOString(), status: "confirmed", source: "operational_audit", payload: { audit_run_id: runId } }).select("id").single();
      if (created.error) throw new Error(created.error.message);
      ids.bookingId = created.data.id;
      const cases = await db.from("cases").select("id", { count: "exact", head: true }).eq("lead_id", ids.leadId);
      assert((cases.count || 0) === 0, "booking_created_case");
      return { linked: true, caseCreatedAutomatically: false };
    }));

    checks.push(await runCheck("Expediente · creación manual", async () => {
      const result = await createConfiguredCase({ organizationId, clientId: text(ids.clientId), destination: "Italia", title: `AUDIT Italia ${runId.slice(0, 8)}`, tripStart: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), tripEnd: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), finalNotes: runId, requestedCurrency: "EUR" });
      const data = repositoryData(result);
      ids.caseId = data.id;
      assert(ids.caseId, "case_missing");
      const linked = await db.from("cases").update({ lead_id: ids.leadId, responsible_user_id: actorId }).eq("id", ids.caseId);
      if (linked.error) throw new Error(linked.error.message);
      return { created: true, caseCode: data.case_code, currency: data.currency };
    }));

    let proposalId = "";
    let versionId = "";
    checks.push(await runCheck("Presupuesto · líneas, margen y totales", async () => {
      const proposal = repositoryData(await createProposalRepository({ organization_id: organizationId, case_id: text(ids.caseId), status: "draft" }));
      proposalId = text(proposal.id);
      const version = await db.from("proposal_versions").select("id").eq("proposal_id", proposalId).single();
      if (version.error) throw new Error(version.error.message);
      versionId = version.data.id;
      const supplier = await db.from("suppliers").select("id,name").eq("organization_id", organizationId).eq("active", true).limit(1).maybeSingle();
      const line1 = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Planificación", service_type_code: "service_fee", cost_budget: 100, margin_applied: 20, sale_price: 125, creates_expected_purchase: false });
      assert(line1.ok, line1.ok ? "" : line1.error);
      const line2 = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Alojamiento", service_type_code: "hotel", supplier_id: supplier.data?.id || null, supplier_name: supplier.data?.name || "Proveedor auditoría", cost_budget: 1000, margin_applied: 20, sale_price: 1250, creates_expected_purchase: true });
      assert(line2.ok, line2.ok ? "" : line2.error);
      const totals = await db.from("proposal_versions").select("total_sale,total_cost_budget,budgeted_profit").eq("id", versionId).single();
      if (totals.error) throw new Error(totals.error.message);
      assert(Math.abs(Number(totals.data.total_sale) - 1375) < 0.01, "wrong_sale_total");
      assert(Math.abs(Number(totals.data.total_cost_budget) - 1100) < 0.01, "wrong_cost_total");
      return totals.data;
    }));

    checks.push(await runCheck("Propuesta pública · token y aceptación", async () => {
      const expiresAt = new Date(Date.now() + 2 * 86400000);
      const token = createProposalToken({ proposalId, versionId, expiresAt });
      const versionUpdate = await db.from("proposal_versions").update({ status: "sent", expires_at: expiresAt.toISOString(), snapshot: { audit_run_id: runId } }).eq("id", versionId);
      if (versionUpdate.error) throw new Error(versionUpdate.error.message);
      const proposalUpdate = await db.from("proposals").update({ status: "sent", current_version_id: versionId, public_token_hash: hashProposalToken(token), public_token_expires_at: expiresAt.toISOString() }).eq("id", proposalId);
      if (proposalUpdate.error) throw new Error(proposalUpdate.error.message);
      const resolved = await resolvePublicProposal(token);
      assert(resolved.ok && resolved.proposalId === proposalId, "public_token_failed");
      const accepted = await db.rpc("accept_proposal_version", { target_version: versionId });
      if (accepted.error) throw new Error(accepted.error.message);
      const acceptance = { organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, case_id: ids.caseId, acceptor_name: "Cliente Auditoría", acceptor_email: email, terms_accepted: true, ip_hash: createHash("sha256").update("audit").digest("hex"), user_agent: "audit", accepted_at: new Date().toISOString() };
      const inserted = await db.from("proposal_acceptances").insert(acceptance);
      if (inserted.error) throw new Error(inserted.error.message);
      const duplicate = await db.from("proposal_acceptances").insert(acceptance);
      assert(duplicate.error?.code === "23505", "duplicate_acceptance_not_blocked");
      const purchases = await db.from("expected_purchases").select("id", { count: "exact", head: true }).eq("case_id", ids.caseId);
      assert((purchases.count || 0) >= 1, "purchase_not_generated");
      return { tokenResolved: true, accepted: true, duplicateBlocked: true, purchases: purchases.count };
    }));

    let contractId = "";
    checks.push(await runCheck("Contrato · versión y firma", async () => {
      const created = await db.rpc("create_contract_version", { target_org: organizationId, target_case: ids.caseId, contract_title: "AUDIT Contrato", legal_version_value: "audit-v1", external_url_value: null, notes_value: runId, contract_status_value: "draft", actor: actorId });
      if (created.error) throw new Error(created.error.message);
      const contract = await db.from("contracts").select("id,current_version_id").eq("case_id", ids.caseId).single();
      if (contract.error) throw new Error(contract.error.message);
      contractId = contract.data.id;
      const signed = await db.rpc("record_contract_signature", { target_org: organizationId, target_contract: contractId, signer_name_value: "Cliente Auditoría", signer_email_value: email, ip_hash_value: createHash("sha256").update("audit-contract").digest("hex"), user_agent_value: "audit", evidence_value: { audit_run_id: runId }, review_confirmed: true, actor: actorId });
      if (signed.error) throw new Error(signed.error.message);
      const state = await db.from("contracts").select("status,signed_at").eq("id", contractId).single();
      if (state.error) throw new Error(state.error.message);
      assert(state.data.status === "signed" && state.data.signed_at, "contract_not_signed");
      return { signed: true, versionId: contract.data.current_version_id };
    }));

    checks.push(await runCheck("Viajeros y documentos · almacenamiento privado", async () => {
      const traveler = await db.from("travelers").insert({ organization_id: organizationId, case_id: ids.caseId, traveler_type: "adult", first_name: "Viajero", last_name: "Auditoría", birth_date: "1990-01-01", nationality: "ES", document_type: "passport", document_country: "ES", issuing_country: "ES", document_number: `AUD${runId.slice(0, 8)}`, document_expires_at: "2030-01-01", review_status: "approved", ocr_status: "reviewed", reviewed_by: actorId, reviewed_at: new Date().toISOString() });
      if (traveler.error) throw new Error(traveler.error.message);
      storagePath = `${organizationId}/audit/${runId}/sample.png`;
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
      const upload = await db.storage.from("case-documents").upload(storagePath, png, { contentType: "image/png" });
      if (upload.error) throw new Error(upload.error.message);
      const signedUrl = await db.storage.from("case-documents").createSignedUrl(storagePath, 60);
      if (signedUrl.error || !signedUrl.data?.signedUrl) throw new Error(signedUrl.error?.message || "signed_url_failed");
      const download = await db.storage.from("case-documents").download(storagePath);
      if (download.error) throw new Error(download.error.message);
      const document = await db.from("documents").insert({ organization_id: organizationId, case_id: ids.caseId, owner_type: "case", owner_id: ids.caseId, document_type: "audit", storage_bucket: "case-documents", storage_path: storagePath, mime_type: "image/png", size_bytes: png.length, retention_until: new Date(Date.now() + 86400000).toISOString(), created_by: actorId, title: "AUDIT Documento", type: "audit", status: "approved", file_name: "sample.png", checksum: createHash("sha256").update(png).digest("hex"), sensitivity: "private", required: true, bucket: "case-documents", uploaded_at: new Date().toISOString(), scan_status: "clean", ocr_status: "reviewed" }).select("id").single();
      if (document.error) throw new Error(document.error.message);
      ids.documentId = document.data.id;
      return { travelerApproved: true, privateUpload: true, signedUrl: true, downloadedBytes: download.data.size };
    }));

    checks.push(await runCheck("Pagos · confirmación e idempotencia", async () => {
      const args = { target_org: organizationId, target_case: ids.caseId, transaction_value: `AUDIT-TX-${runId}`, payment_reference_value: `AUDIT-PAY-${runId}`, amount_value: 1375, currency_value: "EUR", provider_value: "operational_audit", confirmed_timestamp: new Date().toISOString(), payment_payload: { audit_run_id: runId } };
      const first = await db.rpc("confirm_external_payment", args);
      if (first.error) throw new Error(first.error.message);
      const second = await db.rpc("confirm_external_payment", args);
      if (second.error) throw new Error(second.error.message);
      const payments = await db.from("payments").select("id", { count: "exact", head: true }).eq("payment_reference", `AUDIT-PAY-${runId}`);
      assert((payments.count || 0) === 1, "payment_not_idempotent");
      return { confirmed: true, idempotent: true };
    }));

    checks.push(await runCheck("Comunicaciones, tareas y cronología", async () => {
      const followup = await db.from("communication_followups").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, proposal_id: proposalId, contract_id: contractId, kind: "audit_followup", channel: "email", recipient_name: "Cliente Auditoría", recipient_email: email, subject: "AUDIT Seguimiento", body: "No enviar", status: "prepared", due_at: new Date(Date.now() + 86400000).toISOString(), sequence_step: 1, idempotency_key: `audit-followup:${runId}`, metadata: { audit_run_id: runId, do_not_send: true }, created_by: actorId }).select("id").single();
      if (followup.error) throw new Error(followup.error.message);
      ids.followupId = followup.data.id;
      const task = await db.from("tasks").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, title: "AUDIT Tarea", status: "pending", priority: "normal", due_at: new Date(Date.now() + 86400000).toISOString(), assigned_to: actorId, payload: { audit_run_id: runId }, idempotency_key: `audit-task:${runId}` });
      if (task.error) throw new Error(task.error.message);
      const timeline = await db.from("timeline_events").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, event_type: "audit.step", title: "AUDIT Evento", payload: { audit_run_id: runId }, created_by: actorId });
      if (timeline.error) throw new Error(timeline.error.message);
      return { followupPrepared: true, taskCreated: true, timelineCreated: true, outboundMessageSent: false };
    }));

    checks.push(await runCheck("Compras y cierre operativo", async () => {
      const purchases = await db.from("expected_purchases").select("id").eq("case_id", ids.caseId);
      if (purchases.error) throw new Error(purchases.error.message);
      assert((purchases.data || []).length >= 1, "expected_purchase_missing");
      const purchaseIds = (purchases.data || []).map((item) => item.id);
      const resolve = await db.from("expected_purchases").update({ status: "not_required", required: false, active: false, not_required_reason: "Auditoría", not_required_at: new Date().toISOString(), not_required_by: actorId }).in("id", purchaseIds);
      if (resolve.error) throw new Error(resolve.error.message);
      await db.from("tasks").update({ status: "done" }).eq("case_id", ids.caseId);
      await db.from("cases").update({ status: "post_trip", next_action: "Cerrar expediente", blocker: null }).eq("id", ids.caseId);
      const preflight = await db.rpc("operational_close_preflight", { target_case: ids.caseId });
      if (preflight.error) throw new Error(preflight.error.message);
      const close = await db.rpc("close_operational_case", { target_case: ids.caseId, actor: actorId });
      if (close.error) throw new Error(close.error.message);
      const closed = await db.from("cases").select("status,operational_closed_at,close_blockers").eq("id", ids.caseId).single();
      if (closed.error || !closed.data) throw new Error(closed.error?.message || "closed_case_missing");
      assert(Boolean(closed.data.operational_closed_at), `not_closed:${JSON.stringify(close.data)}`);
      return { purchasesResolved: purchaseIds.length, preflight: preflight.data, closeResult: close.data, operationalClosed: true };
    }));

    checks.push(await runCheck("Vistas de gestión · datos relacionados disponibles", async () => {
      const [client, caseRow, proposal, purchases, tasks, events] = await Promise.all([
        db.from("clients").select("id,display_name,email,phone").eq("id", ids.clientId).single(),
        db.from("cases").select("id,case_code,status,accepted_value,currency").eq("id", ids.caseId).single(),
        db.from("proposals").select("id,status,current_version_id").eq("id", proposalId).single(),
        db.from("expected_purchases").select("id,status").eq("case_id", ids.caseId),
        db.from("tasks").select("id,status").eq("case_id", ids.caseId),
        db.from("timeline_events").select("id,event_type").eq("case_id", ids.caseId),
      ]);
      for (const item of [client, caseRow, proposal, purchases, tasks, events]) if (item.error) throw new Error(item.error.message);
      return { client360: Boolean(client.data), caseControl: Boolean(caseRow.data), proposal: Boolean(proposal.data), purchaseRows: purchases.data?.length || 0, taskRows: tasks.data?.length || 0, timelineRows: events.data?.length || 0 };
    }));
  } finally {
    const cleanupErrors: string[] = [];
    async function remove(label: string, operation: PromiseLike<{ error: { message?: string } | null }>) {
      try { const result = await operation; if (result.error) cleanupErrors.push(`${label}:${result.error.message || "failed"}`); }
      catch (error) { cleanupErrors.push(`${label}:${error instanceof Error ? error.message : "failed"}`); }
    }
    if (storagePath) { const removed = await db.storage.from("case-documents").remove([storagePath]); if (removed.error) cleanupErrors.push(`storage:${removed.error.message}`); }
    if (ids.documentId) await remove("document", db.from("documents").delete().eq("id", ids.documentId));
    if (ids.followupId) await remove("followup", db.from("communication_followups").delete().eq("id", ids.followupId));
    if (ids.caseId) {
      await remove("tasks", db.from("tasks").delete().eq("case_id", ids.caseId));
      await remove("timeline", db.from("timeline_events").delete().eq("case_id", ids.caseId));
      await remove("audit_log", db.from("audit_log").delete().eq("entity_id", ids.caseId));
      await remove("case", db.from("cases").delete().eq("id", ids.caseId));
    }
    if (ids.bookingId) await remove("booking", db.from("bookings").delete().eq("id", ids.bookingId));
    if (ids.leadId) await remove("lead", db.from("leads").delete().eq("id", ids.leadId));
    if (ids.clientId) {
      await remove("client_tasks", db.from("tasks").delete().eq("client_id", ids.clientId));
      await remove("client_timeline", db.from("timeline_events").delete().eq("client_id", ids.clientId));
      await remove("client_audit_log", db.from("audit_log").delete().eq("entity_id", ids.clientId));
      await remove("client", db.from("clients").delete().eq("id", ids.clientId));
    }
    checks.push({ name: "Limpieza de datos temporales", ok: cleanupErrors.length === 0, durationMs: 0, details: { errors: cleanupErrors } });
  }

  checks.push(await runCheck("Verificación de limpieza", async () => {
    const [clients, leads, bookings, cases] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("source", "operational_audit").eq("notes", runId),
      db.from("leads").select("id", { count: "exact", head: true }).eq("source_submission_id", `audit-${runId}`),
      db.from("bookings").select("id", { count: "exact", head: true }).eq("external_booking_id", `audit-${runId}`),
      db.from("cases").select("id", { count: "exact", head: true }).eq("final_notes", runId),
    ]);
    for (const item of [clients, leads, bookings, cases]) if (item.error) throw new Error(item.error.message);
    const remaining = (clients.count || 0) + (leads.count || 0) + (bookings.count || 0) + (cases.count || 0);
    assert(remaining === 0, `temporary_rows_remaining:${remaining}`);
    return { remaining: 0 };
  }));

  return { runId, checks };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const payload = row(await request.json().catch(() => ({})));
  const phase = text(payload.phase || "all");
  const db = getSupabaseAdminClient();
  const organization = await db.from("organizations").select("id,name").order("created_at").limit(1).single();
  if (organization.error) return NextResponse.json({ ok: false, error: organization.error.message }, { status: 500 });
  const admin = await db.from("profiles").select("user_id").eq("organization_id", organization.data.id).eq("role", "admin").limit(1).single();
  if (admin.error) return NextResponse.json({ ok: false, error: admin.error.message }, { status: 500 });
  const startedAt = new Date().toISOString();
  const integrations = phase === "operations" ? [] : await integrationChecks(organization.data.id);
  const operations = phase === "integrations" ? null : await operationalChecks(organization.data.id, admin.data.user_id);
  const all = [...integrations, ...(operations?.checks || [])];
  const failed = all.filter((item) => !item.ok);
  return NextResponse.json({ ok: failed.length === 0, phase, startedAt, finishedAt: new Date().toISOString(), summary: { total: all.length, passed: all.length - failed.length, failed: failed.length }, integrationChecks: integrations, operationalRunId: operations?.runId || null, operationalChecks: operations?.checks || [] }, { status: failed.length ? 207 : 200 });
}
