import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createConfiguredCase } from "@/lib/case-creation-server";
import { syncCommunicationFollowups } from "@/lib/communications-server";
import { queueFinalInvoice } from "@/lib/fiscal-workflow-server";
import { addBudgetLineRepository } from "@/lib/server-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "69d26bb0c3b234abe58a82df2618025d493ff5ff6e75391654f3490675eabc88";
type Row = Record<string, unknown>;
type Check = { name: string; ok: boolean; details?: unknown; error?: string };
function text(value: unknown) { return String(value ?? "").trim(); }
function obj(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function authorized(request: NextRequest) { const key = request.nextUrl.searchParams.get("key") || ""; const a = Buffer.from(createHash("sha256").update(key).digest("hex")); const b = Buffer.from(TOKEN_HASH); return a.length === b.length && timingSafeEqual(a, b); }
async function check(name: string, fn: () => Promise<unknown>): Promise<Check> { try { return { name, ok: true, details: await fn() }; } catch (error) { return { name, ok: false, error: error instanceof Error ? error.message : "audit_failed" }; } }

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdminClient();
  const runId = randomUUID();
  const email = `audit.v4.${runId}@example.invalid`;
  const checks: Check[] = [];
  const ids: Row = {};
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
    checks.push(await check("Preparar propuesta enviada con condiciones congeladas", async () => {
      const client = await db.from("clients").insert({ organization_id: organizationId, display_name: `AUDIT-V4 ${runId.slice(0, 8)}`, first_name: "Auditoría", last_name: "Operativa", client_type: "person", email, email_normalized: email, phone: "+34990000002", phone_normalized: `98${runId.replace(/\D/g, "").slice(0, 8)}`, country: "ES", source: "operational_audit_v4", notes: runId }).select("id").single();
      if (client.error) throw new Error(client.error.message);
      ids.clientId = client.data.id;
      const caseResult = await createConfiguredCase({ organizationId, clientId: text(ids.clientId), destination: "Italia", title: `AUDIT-V4 ${runId.slice(0, 8)}`, tripStart: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), tripEnd: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10), finalNotes: runId, requestedCurrency: "EUR" });
      assert(caseResult.ok, caseResult.ok ? "" : caseResult.error);
      ids.caseId = obj(caseResult.data).id;
      const proposalResult = await db.rpc("create_or_get_case_proposal", { target_org: organizationId, target_case: ids.caseId, target_actor: actorId });
      if (proposalResult.error) throw new Error(proposalResult.error.message);
      const proposal = Array.isArray(proposalResult.data) ? proposalResult.data[0] : proposalResult.data;
      proposalId = text(obj(proposal).proposal_id);
      versionId = text(obj(proposal).proposal_version_id);
      const supplier = await db.from("suppliers").select("id,name").eq("organization_id", organizationId).eq("active", true).limit(1).maybeSingle();
      const line = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Alojamiento de auditoría", service_type_code: "accommodation", supplier_id: supplier.data?.id || null, supplier_name: supplier.data?.name || "Proveedor auditoría", cost_budget: 1000, margin_applied: 20, sale_price: 1250, creates_expected_purchase: true });
      assert(line.ok, line.ok ? "" : line.error);
      const sentVersion = await db.from("proposal_versions").update({ status: "sent", expires_at: new Date(Date.now() + 15 * 86400000).toISOString() }).eq("id", versionId).select("terms_snapshot").single();
      if (sentVersion.error) throw new Error(sentVersion.error.message);
      const sentProposal = await db.from("proposals").update({ status: "sent", current_version_id: versionId }).eq("id", proposalId);
      if (sentProposal.error) throw new Error(sentProposal.error.message);
      await db.from("cases").update({ status: "proposal_sent", next_action: "Hacer seguimiento al cliente" }).eq("id", ids.caseId);
      assert(Boolean(text(sentVersion.data.terms_snapshot)), "terms_snapshot_not_frozen");
      return { termsFrozen: true, proposalId, versionId };
    }));

    checks.push(await check("Planificador real de comunicaciones", async () => {
      const sync = await syncCommunicationFollowups(organizationId);
      const followups = await db.from("communication_followups").select("id,thread_key,idempotency_key,status,due_at,channel").eq("case_id", ids.caseId);
      if (followups.error) throw new Error(followups.error.message);
      assert((followups.data || []).length > 0, "followup_not_planned");
      assert((followups.data || []).every((item) => text(item.thread_key) && text(item.idempotency_key)), "followup_keys_missing");
      ids.followupIds = (followups.data || []).map((item) => item.id);
      return { sync, followups: followups.data };
    }));

    checks.push(await check("Aceptar, aprobar viajero y firmar contrato", async () => {
      const accepted = await db.rpc("accept_proposal_version", { target_version: versionId });
      if (accepted.error) throw new Error(accepted.error.message);
      const evidence = await db.from("proposal_acceptances").insert({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, case_id: ids.caseId, acceptor_name: "Cliente Auditoría", acceptor_email: email, terms_accepted: true, ip_hash: createHash("sha256").update("audit-v4").digest("hex"), user_agent: "audit-v4", accepted_at: new Date().toISOString() });
      if (evidence.error) throw new Error(evidence.error.message);
      const traveler = await db.from("travelers").insert({ organization_id: organizationId, case_id: ids.caseId, traveler_type: "adult", first_name: "Viajero", last_name: "Auditoría", birth_date: "1990-01-01", nationality: "ES", document_type: "passport", document_country: "ES", issuing_country: "ES", document_number: `AUDV4${runId.slice(0, 6)}`, document_expires_at: "2030-01-01", review_status: "approved", ocr_status: "reviewed", reviewed_by: actorId, reviewed_at: new Date().toISOString() });
      if (traveler.error) throw new Error(traveler.error.message);
      const contract = await db.rpc("create_contract_version", { target_org: organizationId, target_case: ids.caseId, contract_title: "Contrato auditoría", legal_version_value: "audit-v4", external_url_value: null, notes_value: runId, contract_status_value: "draft", actor: actorId });
      if (contract.error) throw new Error(contract.error.message);
      const contractRow = await db.from("contracts").select("id").eq("case_id", ids.caseId).single();
      if (contractRow.error) throw new Error(contractRow.error.message);
      contractId = contractRow.data.id;
      const signature = await db.rpc("record_contract_signature", { target_org: organizationId, target_contract: contractId, signer_name_value: "Cliente Auditoría", signer_email_value: email, ip_hash_value: createHash("sha256").update("audit-v4-contract").digest("hex"), user_agent_value: "audit-v4", evidence_value: { audit_run_id: runId }, review_confirmed: true, actor: actorId });
      if (signature.error) throw new Error(signature.error.message);
      return { accepted: true, travelerApproved: true, contractSigned: true };
    }));

    checks.push(await check("Pago, proforma y cola fiscal", async () => {
      const payment = await db.rpc("confirm_external_payment", { target_org: organizationId, target_case: ids.caseId, transaction_value: `AUD-V4-TX-${runId}`, payment_reference_value: `AUD-V4-PAY-${runId}`, amount_value: 1250, currency_value: "EUR", provider_value: "operational_audit_v4", confirmed_timestamp: new Date().toISOString(), payment_payload: { audit_run_id: runId } });
      if (payment.error) throw new Error(payment.error.message);
      const proforma = await db.from("billing_documents").select("id,document_type,status,sync_status").eq("case_id", ids.caseId).eq("document_type", "proforma").maybeSingle();
      if (proforma.error) throw new Error(proforma.error.message);
      assert(Boolean(proforma.data?.id), "proforma_not_created");
      const proformaOutbox = await db.from("integration_outbox").select("id,status,event_type").eq("related_case_id", ids.caseId).eq("event_type", "proforma.create");
      if (proformaOutbox.error) throw new Error(proformaOutbox.error.message);
      assert((proformaOutbox.data || []).length === 1, "proforma_outbox_missing");
      return { proforma: proforma.data, queued: true };
    }));

    checks.push(await check("Factura final, estado fiscal y cierre", async () => {
      const purchases = await db.from("expected_purchases").select("id").eq("case_id", ids.caseId);
      if (purchases.error) throw new Error(purchases.error.message);
      const purchaseIds = (purchases.data || []).map((item) => item.id);
      const resolved = await db.from("expected_purchases").update({ status: "not_required", required: false, active: false, not_required_reason: "Auditoría", not_required_at: new Date().toISOString(), not_required_by: actorId }).in("id", purchaseIds);
      if (resolved.error) throw new Error(resolved.error.message);
      const queued = await queueFinalInvoice({ organizationId, caseId: text(ids.caseId), actorId });
      assert(queued.ok, queued.ok ? "" : `final_invoice_blockers:${queued.blockers.join(",")}`);
      const documentId = queued.document.id;
      const simulated = await db.from("billing_documents").update({ status: "issued", sync_status: "synced", external_document_id: `AUDIT-${runId}`, holded_document_id: `AUDIT-${runId}`, document_number: `AUD-${runId.slice(0, 8)}`, issued_at: new Date().toISOString(), last_synced_at: new Date().toISOString(), sync_message: "Respuesta Holded simulada únicamente para auditoría temporal." }).eq("id", documentId);
      if (simulated.error) throw new Error(simulated.error.message);
      const caseFiscal = await db.from("cases").select("billing_status").eq("id", ids.caseId).single();
      if (caseFiscal.error) throw new Error(caseFiscal.error.message);
      assert(caseFiscal.data.billing_status === "final_invoice_issued", `billing_status:${caseFiscal.data.billing_status}`);
      await db.from("tasks").update({ status: "done" }).eq("case_id", ids.caseId);
      const preflight = await db.rpc("operational_close_preflight", { target_case: ids.caseId });
      if (preflight.error) throw new Error(preflight.error.message);
      assert(obj(preflight.data).ready === true, `preflight_blockers:${JSON.stringify(obj(preflight.data).blockers)}`);
      const closed = await db.rpc("close_operational_case", { target_case: ids.caseId, actor: actorId });
      if (closed.error) throw new Error(closed.error.message);
      const state = await db.from("cases").select("status,operational_closed_at,billing_status").eq("id", ids.caseId).single();
      if (state.error) throw new Error(state.error.message);
      assert(state.data.status === "closed" && state.data.operational_closed_at, "case_not_closed");
      return { finalInvoiceQueued: true, externalWritePerformed: false, billingStatus: state.data.billing_status, closed: true };
    }));
  } finally {
    const errors: string[] = [];
    async function remove(label: string, operation: PromiseLike<{ error: { message?: string } | null }>) { try { const result = await operation; if (result.error) errors.push(`${label}:${result.error.message || "failed"}`); } catch (error) { errors.push(`${label}:${error instanceof Error ? error.message : "failed"}`); } }
    if (ids.caseId) {
      await remove("outbox", db.from("integration_outbox").delete().eq("related_case_id", ids.caseId));
      await remove("tasks", db.from("tasks").delete().eq("case_id", ids.caseId));
      await remove("followups", db.from("communication_followups").delete().eq("case_id", ids.caseId));
      await remove("timeline", db.from("timeline_events").delete().eq("case_id", ids.caseId));
      await remove("audit", db.from("audit_log").delete().eq("entity_id", ids.caseId));
      await remove("case", db.from("cases").delete().eq("id", ids.caseId));
    }
    if (ids.clientId) {
      await remove("client_tasks", db.from("tasks").delete().eq("client_id", ids.clientId));
      await remove("client_followups", db.from("communication_followups").delete().eq("client_id", ids.clientId));
      await remove("client_timeline", db.from("timeline_events").delete().eq("client_id", ids.clientId));
      await remove("client_audit", db.from("audit_log").delete().eq("entity_id", ids.clientId));
      await remove("client", db.from("clients").delete().eq("id", ids.clientId));
    }
    checks.push({ name: "Limpieza", ok: errors.length === 0, details: { errors } });
  }

  checks.push(await check("Verificación de limpieza", async () => {
    const [clients, cases, outbox] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("source", "operational_audit_v4").eq("notes", runId),
      db.from("cases").select("id", { count: "exact", head: true }).eq("final_notes", runId),
      db.from("integration_outbox").select("id", { count: "exact", head: true }).contains("payload", { audit_run_id: runId }),
    ]);
    for (const item of [clients, cases, outbox]) if (item.error) throw new Error(item.error.message);
    const remaining = (clients.count || 0) + (cases.count || 0) + (outbox.count || 0);
    assert(remaining === 0, `temporary_data_remaining:${remaining}`);
    return { remaining: 0 };
  }));

  const failed = checks.filter((item) => !item.ok);
  return NextResponse.json({ ok: failed.length === 0, runId, summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length }, checks }, { status: failed.length ? 207 : 200 });
}
