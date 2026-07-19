import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createConfiguredCase } from "@/lib/case-creation-server";
import { createProposalToken, hashProposalToken } from "@/lib/proposal-token";
import { resolvePublicProposal } from "@/lib/proposal-public-server";
import { addBudgetLineRepository } from "@/lib/server-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "69d26bb0c3b234abe58a82df2618025d493ff5ff6e75391654f3490675eabc88";
type Check = { name: string; ok: boolean; details?: unknown; error?: string; durationMs: number };
type JsonRow = Record<string, unknown>;

function text(value: unknown) { return String(value ?? "").trim(); }
function row(value: unknown): JsonRow { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRow : {}; }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function authorized(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || "";
  const actual = createHash("sha256").update(key).digest("hex");
  const left = Buffer.from(actual); const right = Buffer.from(TOKEN_HASH);
  return left.length === right.length && timingSafeEqual(left, right);
}
async function check(name: string, fn: () => Promise<unknown>): Promise<Check> {
  const started = Date.now();
  try { return { name, ok: true, details: await fn(), durationMs: Date.now() - started }; }
  catch (error) { return { name, ok: false, error: error instanceof Error ? error.message : "audit_failed", durationMs: Date.now() - started }; }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdminClient();
  const runId = randomUUID();
  const email = `audit.v2.${runId}@example.invalid`;
  const phone = `+3488${Date.now().toString().slice(-7)}`;
  const checks: Check[] = [];
  const ids: JsonRow = {};
  let storagePath = "";
  let proposalId = "";
  let versionId = "";
  let contractId = "";

  const organization = await db.from("organizations").select("id").order("created_at").limit(1).single();
  if (organization.error) return NextResponse.json({ ok: false, error: organization.error.message }, { status: 500 });
  const organizationId = organization.data.id;
  const admin = await db.from("profiles").select("user_id").eq("organization_id", organizationId).eq("role", "admin").limit(1).single();
  if (admin.error) return NextResponse.json({ ok: false, error: admin.error.message }, { status: 500 });
  const actorId = admin.data.user_id;

  try {
    checks.push(await check("Cliente, solicitud y booking", async () => {
      const client = await db.from("clients").insert({ organization_id: organizationId, client_type: "person", display_name: `AUDIT-V2 ${runId.slice(0, 8)}`, first_name: "Auditoría", last_name: "Operativa", email, email_normalized: email, phone, phone_normalized: phone.replace(/\D/g, ""), country: "ES", source: "operational_audit_v2", notes: runId }).select("id").single();
      if (client.error) throw new Error(client.error.message);
      ids.clientId = client.data.id;
      const lead = await db.from("leads").insert({ organization_id: organizationId, client_id: ids.clientId, source: "operational_audit_v2", source_submission_id: `audit-v2-${runId}`, status: "qualified", client_name: "Auditoría Operativa", email, email_normalized: email, phone, phone_normalized: phone.replace(/\D/g, ""), destination: "Italia", travel_start: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), travel_end: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10), travelers: 2, budget_hint: 2500, payload_redacted: { audit_run_id: runId } }).select("id").single();
      if (lead.error) throw new Error(lead.error.message);
      ids.leadId = lead.data.id;
      const booking = await db.from("bookings").insert({ organization_id: organizationId, client_id: ids.clientId, lead_id: ids.leadId, external_booking_id: `audit-v2-${runId}`, external_id: `audit-v2-${runId}`, event_type: "consultation", starts_at: new Date(Date.now() + 86400000).toISOString(), ends_at: new Date(Date.now() + 86400000 + 30 * 60000).toISOString(), status: "confirmed", source: "operational_audit_v2", payload: { audit_run_id: runId } }).select("id").single();
      if (booking.error) throw new Error(booking.error.message);
      ids.bookingId = booking.data.id;
      const caseCount = await db.from("cases").select("id", { count: "exact", head: true }).eq("lead_id", ids.leadId);
      assert((caseCount.count || 0) === 0, "booking_created_case_automatically");
      return { client: true, lead: true, booking: true, automaticCase: false };
    }));

    checks.push(await check("Expediente manual", async () => {
      const result = await createConfiguredCase({ organizationId, clientId: text(ids.clientId), destination: "Italia", title: `AUDIT-V2 Italia ${runId.slice(0, 8)}`, tripStart: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), tripEnd: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10), finalNotes: runId, requestedCurrency: "EUR" });
      assert(result.ok, result.ok ? "" : result.error);
      const data = row(result.data);
      ids.caseId = data.id;
      const linked = await db.from("cases").update({ lead_id: ids.leadId, responsible_user_id: actorId }).eq("id", ids.caseId);
      if (linked.error) throw new Error(linked.error.message);
      return { caseCode: data.case_code, currency: data.currency };
    }));

    checks.push(await check("Presupuesto real · RPC, versión y economía", async () => {
      const operationResult = await db.rpc("create_or_get_case_proposal", { target_org: organizationId, target_case: ids.caseId, target_actor: actorId });
      if (operationResult.error) throw new Error(operationResult.error.message);
      const operation = Array.isArray(operationResult.data) ? operationResult.data[0] : operationResult.data;
      proposalId = text(row(operation).proposal_id);
      assert(proposalId, "proposal_id_missing");
      const version = await db.from("proposal_versions").select("id").eq("proposal_id", proposalId).order("version_number", { ascending: false }).limit(1).single();
      if (version.error) throw new Error(version.error.message);
      versionId = version.data.id;
      const supplier = await db.from("suppliers").select("id,name").eq("organization_id", organizationId).eq("active", true).limit(1).maybeSingle();
      const line1 = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Planificación", service_type_code: "service_fee", cost_budget: 100, margin_applied: 20, sale_price: 125, creates_expected_purchase: false });
      assert(line1.ok, line1.ok ? "" : line1.error);
      const line2 = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Alojamiento", service_type_code: "hotel", supplier_id: supplier.data?.id || null, supplier_name: supplier.data?.name || "Proveedor auditoría", cost_budget: 1000, margin_applied: 20, sale_price: 1250, creates_expected_purchase: true });
      assert(line2.ok, line2.ok ? "" : line2.error);
      const totals = await db.from("proposal_versions").select("total_sale,total_cost_budget,budgeted_profit").eq("id", versionId).single();
      if (totals.error) throw new Error(totals.error.message);
      assert(Number(totals.data.total_sale) === 1375, `total_sale:${totals.data.total_sale}`);
      assert(Number(totals.data.total_cost_budget) === 1100, `total_cost:${totals.data.total_cost_budget}`);
      return { proposalId, versionId, totals: totals.data, supplierLinked: Boolean(supplier.data?.id) };
    }));

    checks.push(await check("Enlace público de propuesta", async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      const token = createProposalToken({ proposalId, versionId, expiresAt });
      const versionUpdate = await db.from("proposal_versions").update({ status: "sent", expires_at: expiresAt.toISOString(), snapshot: { audit_run_id: runId } }).eq("id", versionId);
      if (versionUpdate.error) throw new Error(versionUpdate.error.message);
      const proposalUpdate = await db.from("proposals").update({ status: "sent", current_version_id: versionId, public_token_hash: hashProposalToken(token), public_token_expires_at: expiresAt.toISOString() }).eq("id", proposalId);
      if (proposalUpdate.error) throw new Error(proposalUpdate.error.message);
      const resolved = await resolvePublicProposal(token);
      assert(resolved.ok && resolved.proposalId === proposalId && resolved.versionId === versionId, "public_proposal_resolution_failed");
      return { configured: true, resolved: true };
    }));

    checks.push(await check("Aceptación y compras esperadas", async () => {
      const current = await db.from("proposals").select("status,current_version_id").eq("id", proposalId).single();
      if (current.error) throw new Error(current.error.message);
      if (current.data.status !== "sent") {
        const versionSent = await db.from("proposal_versions").update({ status: "sent" }).eq("id", versionId);
        if (versionSent.error) throw new Error(versionSent.error.message);
        const proposalSent = await db.from("proposals").update({ status: "sent", current_version_id: versionId }).eq("id", proposalId);
        if (proposalSent.error) throw new Error(proposalSent.error.message);
      }
      const accepted = await db.rpc("accept_proposal_version", { target_version: versionId });
      if (accepted.error) throw new Error(accepted.error.message);
      const acceptance = { organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, case_id: ids.caseId, acceptor_name: "Cliente Auditoría", acceptor_email: email, terms_accepted: true, ip_hash: createHash("sha256").update("audit-v2").digest("hex"), user_agent: "audit-v2", accepted_at: new Date().toISOString() };
      const evidence = await db.from("proposal_acceptances").insert(acceptance);
      if (evidence.error) throw new Error(evidence.error.message);
      const duplicate = await db.from("proposal_acceptances").insert(acceptance);
      assert(duplicate.error?.code === "23505", "acceptance_not_idempotent");
      const purchases = await db.from("expected_purchases").select("id,status,expected_amount,supplier_id").eq("case_id", ids.caseId);
      if (purchases.error) throw new Error(purchases.error.message);
      assert((purchases.data || []).length >= 1, "expected_purchase_not_generated");
      return { accepted: true, duplicateBlocked: true, purchases: purchases.data?.length || 0 };
    }));

    checks.push(await check("Contrato firmado", async () => {
      const created = await db.rpc("create_contract_version", { target_org: organizationId, target_case: ids.caseId, contract_title: "AUDIT-V2 Contrato", legal_version_value: "audit-v2", external_url_value: null, notes_value: runId, contract_status_value: "draft", actor: actorId });
      if (created.error) throw new Error(created.error.message);
      const contract = await db.from("contracts").select("id,current_version_id").eq("case_id", ids.caseId).single();
      if (contract.error) throw new Error(contract.error.message);
      contractId = contract.data.id;
      const signed = await db.rpc("record_contract_signature", { target_org: organizationId, target_contract: contractId, signer_name_value: "Cliente Auditoría", signer_email_value: email, ip_hash_value: createHash("sha256").update("audit-v2-contract").digest("hex"), user_agent_value: "audit-v2", evidence_value: { audit_run_id: runId }, review_confirmed: true, actor: actorId });
      if (signed.error) throw new Error(signed.error.message);
      const state = await db.from("contracts").select("status,signed_at").eq("id", contractId).single();
      if (state.error) throw new Error(state.error.message);
      assert(state.data.status === "signed" && state.data.signed_at, "contract_not_signed");
      return { contractId, signed: true };
    }));

    checks.push(await check("Viajeros, OCR y almacenamiento", async () => {
      const traveler = await db.from("travelers").insert({ organization_id: organizationId, case_id: ids.caseId, traveler_type: "adult", first_name: "Viajero", last_name: "Auditoría", birth_date: "1990-01-01", nationality: "ES", document_type: "passport", document_country: "ES", issuing_country: "ES", document_number: `AUDV2${runId.slice(0, 6)}`, document_expires_at: "2030-01-01", review_status: "approved", ocr_status: "reviewed", reviewed_by: actorId, reviewed_at: new Date().toISOString() });
      if (traveler.error) throw new Error(traveler.error.message);
      storagePath = `${organizationId}/audit-v2/${runId}/sample.png`;
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
      const upload = await db.storage.from("case-documents").upload(storagePath, png, { contentType: "image/png" });
      if (upload.error) throw new Error(upload.error.message);
      const signedUrl = await db.storage.from("case-documents").createSignedUrl(storagePath, 60);
      if (signedUrl.error || !signedUrl.data?.signedUrl) throw new Error(signedUrl.error?.message || "signed_url_failed");
      const download = await db.storage.from("case-documents").download(storagePath);
      if (download.error) throw new Error(download.error.message);
      const document = await db.from("documents").insert({ organization_id: organizationId, case_id: ids.caseId, owner_type: "case", owner_id: ids.caseId, document_type: "audit", storage_bucket: "case-documents", storage_path: storagePath, mime_type: "image/png", size_bytes: png.length, retention_until: new Date(Date.now() + 86400000).toISOString(), created_by: actorId, title: "AUDIT-V2 Documento", type: "audit", status: "approved", file_name: "sample.png", checksum: createHash("sha256").update(png).digest("hex"), sensitivity: "private", required: true, bucket: "case-documents", uploaded_at: new Date().toISOString(), scan_status: "clean", ocr_status: "reviewed" }).select("id").single();
      if (document.error) throw new Error(document.error.message);
      ids.documentId = document.data.id;
      return { traveler: true, ocrReviewed: true, signedUrl: true, downloadedBytes: download.data.size };
    }));

    checks.push(await check("Pago confirmado e idempotente", async () => {
      const args = { target_org: organizationId, target_case: ids.caseId, transaction_value: `AUDIT-V2-TX-${runId}`, payment_reference_value: `AUDIT-V2-PAY-${runId}`, amount_value: 1375, currency_value: "EUR", provider_value: "operational_audit_v2", confirmed_timestamp: new Date().toISOString(), payment_payload: { audit_run_id: runId } };
      const first = await db.rpc("confirm_external_payment", args); if (first.error) throw new Error(first.error.message);
      const second = await db.rpc("confirm_external_payment", args); if (second.error) throw new Error(second.error.message);
      const count = await db.from("payments").select("id", { count: "exact", head: true }).eq("payment_reference", `AUDIT-V2-PAY-${runId}`);
      assert((count.count || 0) === 1, "payment_not_idempotent");
      return { confirmed: true, records: count.count };
    }));

    checks.push(await check("Comunicaciones, tareas y timeline", async () => {
      const followup = await db.from("communication_followups").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, proposal_id: proposalId, contract_id: contractId, kind: "audit_followup", channel: "email", recipient_name: "Cliente Auditoría", recipient_email: email, subject: "AUDIT-V2 Seguimiento", body: "No enviar", status: "prepared", due_at: new Date(Date.now() + 86400000).toISOString(), sequence_step: 1, idempotency_key: `audit-v2-followup:${runId}`, metadata: { audit_run_id: runId, do_not_send: true }, created_by: actorId }).select("id").single();
      if (followup.error) throw new Error(followup.error.message);
      ids.followupId = followup.data.id;
      const task = await db.from("tasks").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, title: "AUDIT-V2 Tarea", status: "pending", priority: "normal", due_at: new Date(Date.now() + 86400000).toISOString(), assigned_to: actorId, payload: { audit_run_id: runId }, idempotency_key: `audit-v2-task:${runId}` });
      if (task.error) throw new Error(task.error.message);
      const event = await db.from("timeline_events").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, event_type: "audit_v2.step", title: "AUDIT-V2 Evento", payload: { audit_run_id: runId }, created_by: actorId });
      if (event.error) throw new Error(event.error.message);
      return { followupPrepared: true, messageSent: false, taskCreated: true, eventCreated: true };
    }));

    checks.push(await check("Compras y cierre operativo", async () => {
      const purchases = await db.from("expected_purchases").select("id").eq("case_id", ids.caseId);
      if (purchases.error) throw new Error(purchases.error.message);
      const purchaseIds = (purchases.data || []).map((item) => item.id);
      assert(purchaseIds.length > 0, "no_expected_purchases");
      const resolved = await db.from("expected_purchases").update({ status: "not_required", required: false, active: false, not_required_reason: "Auditoría v2", not_required_at: new Date().toISOString(), not_required_by: actorId }).in("id", purchaseIds);
      if (resolved.error) throw new Error(resolved.error.message);
      await db.from("tasks").update({ status: "done" }).eq("case_id", ids.caseId);
      await db.from("cases").update({ status: "post_trip", next_action: "Cerrar expediente", blocker: null }).eq("id", ids.caseId);
      const preflight = await db.rpc("operational_close_preflight", { target_case: ids.caseId });
      if (preflight.error) throw new Error(preflight.error.message);
      const close = await db.rpc("close_operational_case", { target_case: ids.caseId, actor: actorId });
      if (close.error) throw new Error(close.error.message);
      const state = await db.from("cases").select("status,operational_closed_at,close_blockers").eq("id", ids.caseId).single();
      if (state.error) throw new Error(state.error.message);
      assert(Boolean(state.data.operational_closed_at), `not_closed:${JSON.stringify(close.data)}`);
      return { resolvedPurchases: purchaseIds.length, preflight: preflight.data, close: close.data, operationalClosed: true };
    }));

    checks.push(await check("Cliente 360 y vistas de gestión", async () => {
      const [client, caseData, proposal, purchase, task, timeline] = await Promise.all([
        db.from("clients").select("id,display_name,email,phone").eq("id", ids.clientId).single(),
        db.from("cases").select("id,case_code,status,accepted_value,currency").eq("id", ids.caseId).single(),
        db.from("proposals").select("id,status,current_version_id").eq("id", proposalId).single(),
        db.from("expected_purchases").select("id,status").eq("case_id", ids.caseId),
        db.from("tasks").select("id,status").eq("case_id", ids.caseId),
        db.from("timeline_events").select("id,event_type").eq("case_id", ids.caseId),
      ]);
      for (const result of [client, caseData, proposal, purchase, task, timeline]) if (result.error) throw new Error(result.error.message);
      return { client360: Boolean(client.data), control: Boolean(caseData.data), proposal: Boolean(proposal.data), purchases: purchase.data?.length || 0, tasks: task.data?.length || 0, timeline: timeline.data?.length || 0 };
    }));
  } finally {
    const errors: string[] = [];
    async function remove(label: string, promise: PromiseLike<{ error: { message?: string } | null }>) { try { const result = await promise; if (result.error) errors.push(`${label}:${result.error.message || "failed"}`); } catch (error) { errors.push(`${label}:${error instanceof Error ? error.message : "failed"}`); } }
    if (storagePath) { const result = await db.storage.from("case-documents").remove([storagePath]); if (result.error) errors.push(`storage:${result.error.message}`); }
    if (ids.documentId) await remove("document", db.from("documents").delete().eq("id", ids.documentId));
    if (ids.followupId) await remove("followup", db.from("communication_followups").delete().eq("id", ids.followupId));
    if (ids.caseId) {
      await remove("tasks", db.from("tasks").delete().eq("case_id", ids.caseId));
      await remove("timeline", db.from("timeline_events").delete().eq("case_id", ids.caseId));
      await remove("audit", db.from("audit_log").delete().eq("entity_id", ids.caseId));
      await remove("case", db.from("cases").delete().eq("id", ids.caseId));
    }
    if (ids.bookingId) await remove("booking", db.from("bookings").delete().eq("id", ids.bookingId));
    if (ids.leadId) await remove("lead", db.from("leads").delete().eq("id", ids.leadId));
    if (ids.clientId) {
      await remove("client_tasks", db.from("tasks").delete().eq("client_id", ids.clientId));
      await remove("client_timeline", db.from("timeline_events").delete().eq("client_id", ids.clientId));
      await remove("client_audit", db.from("audit_log").delete().eq("entity_id", ids.clientId));
      await remove("client", db.from("clients").delete().eq("id", ids.clientId));
    }
    checks.push({ name: "Limpieza", ok: errors.length === 0, details: { errors }, durationMs: 0 });
  }

  checks.push(await check("Verificación de limpieza", async () => {
    const [clients, leads, bookings, cases] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("source", "operational_audit_v2").eq("notes", runId),
      db.from("leads").select("id", { count: "exact", head: true }).eq("source_submission_id", `audit-v2-${runId}`),
      db.from("bookings").select("id", { count: "exact", head: true }).eq("external_booking_id", `audit-v2-${runId}`),
      db.from("cases").select("id", { count: "exact", head: true }).eq("final_notes", runId),
    ]);
    for (const result of [clients, leads, bookings, cases]) if (result.error) throw new Error(result.error.message);
    const remaining = (clients.count || 0) + (leads.count || 0) + (bookings.count || 0) + (cases.count || 0);
    assert(remaining === 0, `temporary_data_remaining:${remaining}`);
    return { remaining: 0 };
  }));

  const failed = checks.filter((item) => !item.ok);
  return NextResponse.json({ ok: failed.length === 0, runId, summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length }, checks }, { status: failed.length ? 207 : 200 });
}
