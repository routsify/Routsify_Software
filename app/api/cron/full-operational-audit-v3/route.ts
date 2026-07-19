import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createConfiguredCase } from "@/lib/case-creation-server";
import { addBudgetLineRepository } from "@/lib/server-repositories";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "69d26bb0c3b234abe58a82df2618025d493ff5ff6e75391654f3490675eabc88";
const ACCEPTED_TERMS = "La aceptación confirma la conformidad con los servicios, fechas e importes mostrados en esta versión. Routsify preparará el contrato, solicitará la documentación necesaria y coordinará los pagos y reservas correspondientes conforme a las condiciones contractuales aplicables.";
type Row = Record<string, unknown>;
type Result = { name: string; ok: boolean; details?: unknown; error?: string };

function text(value: unknown) { return String(value ?? "").trim(); }
function obj(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function authorized(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || "";
  const a = Buffer.from(createHash("sha256").update(key).digest("hex"));
  const b = Buffer.from(TOKEN_HASH);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function test(name: string, fn: () => Promise<unknown>): Promise<Result> {
  try { return { name, ok: true, details: await fn() }; }
  catch (error) { return { name, ok: false, error: error instanceof Error ? error.message : "audit_failed" }; }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdminClient();
  const runId = randomUUID();
  const email = `audit.v3.${runId}@example.invalid`;
  const results: Result[] = [];
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
    results.push(await test("Preparación de expediente y presupuesto aceptable", async () => {
      const client = await db.from("clients").insert({ organization_id: organizationId, display_name: `AUDIT-V3 ${runId.slice(0, 8)}`, first_name: "Auditoría", last_name: "Operativa", client_type: "person", email, email_normalized: email, phone: "+34990000001", phone_normalized: `99${runId.replace(/\D/g, "").slice(0, 8)}`, country: "ES", source: "operational_audit_v3", notes: runId }).select("id").single();
      if (client.error) throw new Error(client.error.message);
      ids.clientId = client.data.id;
      const caseResult = await createConfiguredCase({ organizationId, clientId: text(ids.clientId), destination: "Italia", title: `AUDIT-V3 ${runId.slice(0, 8)}`, tripStart: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), tripEnd: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10), finalNotes: runId, requestedCurrency: "EUR" });
      assert(caseResult.ok, caseResult.ok ? "" : caseResult.error);
      ids.caseId = obj(caseResult.data).id;
      const operationResult = await db.rpc("create_or_get_case_proposal", { target_org: organizationId, target_case: ids.caseId, target_actor: actorId });
      if (operationResult.error) throw new Error(operationResult.error.message);
      const operation = Array.isArray(operationResult.data) ? operationResult.data[0] : operationResult.data;
      proposalId = text(obj(operation).proposal_id);
      versionId = text(obj(operation).proposal_version_id);
      assert(proposalId && versionId, "proposal_or_version_missing");
      const supplier = await db.from("suppliers").select("id,name").eq("organization_id", organizationId).eq("active", true).limit(1).maybeSingle();
      const line = await addBudgetLineRepository({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, description_public: "Alojamiento de auditoría", service_type_code: "accommodation", supplier_id: supplier.data?.id || null, supplier_name: supplier.data?.name || "Proveedor auditoría", cost_budget: 1000, margin_applied: 20, sale_price: 1250, creates_expected_purchase: true });
      assert(line.ok, line.ok ? "" : line.error);
      const versionUpdate = await db.from("proposal_versions").update({ terms_snapshot: ACCEPTED_TERMS, status: "sent" }).eq("id", versionId);
      if (versionUpdate.error) throw new Error(versionUpdate.error.message);
      const proposalUpdate = await db.from("proposals").update({ status: "sent", current_version_id: versionId }).eq("id", proposalId);
      if (proposalUpdate.error) throw new Error(proposalUpdate.error.message);
      return { caseId: ids.caseId, proposalId, versionId, termsFrozen: true };
    }));

    results.push(await test("Aceptación y compra esperada", async () => {
      const accepted = await db.rpc("accept_proposal_version", { target_version: versionId });
      if (accepted.error) throw new Error(accepted.error.message);
      const evidence = await db.from("proposal_acceptances").insert({ organization_id: organizationId, proposal_id: proposalId, proposal_version_id: versionId, case_id: ids.caseId, acceptor_name: "Cliente Auditoría", acceptor_email: email, terms_accepted: true, ip_hash: createHash("sha256").update("audit-v3").digest("hex"), user_agent: "audit-v3", accepted_at: new Date().toISOString() });
      if (evidence.error) throw new Error(evidence.error.message);
      const purchases = await db.from("expected_purchases").select("id,status").eq("case_id", ids.caseId);
      if (purchases.error) throw new Error(purchases.error.message);
      assert((purchases.data || []).length === 1, `expected_purchase_count:${purchases.data?.length || 0}`);
      return { accepted: true, purchases: purchases.data };
    }));

    results.push(await test("Viajero aprobado antes del contrato", async () => {
      const traveler = await db.from("travelers").insert({ organization_id: organizationId, case_id: ids.caseId, traveler_type: "adult", first_name: "Viajero", last_name: "Auditoría", birth_date: "1990-01-01", nationality: "ES", document_type: "passport", document_country: "ES", issuing_country: "ES", document_number: `AUDV3${runId.slice(0, 6)}`, document_expires_at: "2030-01-01", review_status: "approved", ocr_status: "reviewed", reviewed_by: actorId, reviewed_at: new Date().toISOString() }).select("id").single();
      if (traveler.error) throw new Error(traveler.error.message);
      ids.travelerId = traveler.data.id;
      return { approved: true };
    }));

    results.push(await test("Contrato versionado y firmado", async () => {
      const created = await db.rpc("create_contract_version", { target_org: organizationId, target_case: ids.caseId, contract_title: "Contrato auditoría", legal_version_value: "audit-v3", external_url_value: null, notes_value: runId, contract_status_value: "draft", actor: actorId });
      if (created.error) throw new Error(created.error.message);
      const contract = await db.from("contracts").select("id,current_version_id").eq("case_id", ids.caseId).single();
      if (contract.error) throw new Error(contract.error.message);
      contractId = contract.data.id;
      const signed = await db.rpc("record_contract_signature", { target_org: organizationId, target_contract: contractId, signer_name_value: "Cliente Auditoría", signer_email_value: email, ip_hash_value: createHash("sha256").update("audit-v3-contract").digest("hex"), user_agent_value: "audit-v3", evidence_value: { audit_run_id: runId, consent: true }, review_confirmed: true, actor: actorId });
      if (signed.error) throw new Error(signed.error.message);
      const state = await db.from("contracts").select("status,signed_at").eq("id", contractId).single();
      if (state.error) throw new Error(state.error.message);
      assert(state.data.status === "signed" && state.data.signed_at, "contract_not_signed");
      return { contractId, signed: true, versionId: contract.data.current_version_id };
    }));

    results.push(await test("Pago confirmado e idempotente", async () => {
      const input = { target_org: organizationId, target_case: ids.caseId, transaction_value: `AUD-V3-TX-${runId}`, payment_reference_value: `AUD-V3-PAY-${runId}`, amount_value: 1250, currency_value: "EUR", provider_value: "operational_audit_v3", confirmed_timestamp: new Date().toISOString(), payment_payload: { audit_run_id: runId } };
      const first = await db.rpc("confirm_external_payment", input); if (first.error) throw new Error(first.error.message);
      const second = await db.rpc("confirm_external_payment", input); if (second.error) throw new Error(second.error.message);
      const count = await db.from("payments").select("id", { count: "exact", head: true }).eq("payment_reference", `AUD-V3-PAY-${runId}`);
      assert((count.count || 0) === 1, `payment_count:${count.count || 0}`);
      return { confirmed: true, idempotent: true };
    }));

    results.push(await test("Comunicación, tareas y trazabilidad", async () => {
      const followup = await db.from("communication_followups").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, proposal_id: proposalId, contract_id: contractId, kind: "audit_followup", channel: "email", recipient_name: "Cliente Auditoría", recipient_email: email, subject: "Seguimiento auditoría", body: "No enviar", status: "prepared", due_at: new Date(Date.now() + 86400000).toISOString(), sequence_step: 1, idempotency_key: `audit-v3-followup:${runId}`, metadata: { audit_run_id: runId, do_not_send: true }, created_by: actorId }).select("id").single();
      if (followup.error) throw new Error(followup.error.message);
      ids.followupId = followup.data.id;
      const task = await db.from("tasks").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, title: "Tarea auditoría", status: "pending", priority: "normal", due_at: new Date(Date.now() + 86400000).toISOString(), assigned_to: actorId, payload: { audit_run_id: runId }, idempotency_key: `audit-v3-task:${runId}` });
      if (task.error) throw new Error(task.error.message);
      const event = await db.from("timeline_events").insert({ organization_id: organizationId, case_id: ids.caseId, client_id: ids.clientId, event_type: "audit_v3.step", title: "Evento auditoría", payload: { audit_run_id: runId }, created_by: actorId });
      if (event.error) throw new Error(event.error.message);
      return { followupPrepared: true, sentExternally: false, task: true, timeline: true };
    }));

    results.push(await test("Compras resueltas y cierre operativo", async () => {
      const purchases = await db.from("expected_purchases").select("id").eq("case_id", ids.caseId);
      if (purchases.error) throw new Error(purchases.error.message);
      const purchaseIds = (purchases.data || []).map((item) => item.id);
      const update = await db.from("expected_purchases").update({ status: "not_required", required: false, active: false, not_required_reason: "Auditoría", not_required_at: new Date().toISOString(), not_required_by: actorId }).in("id", purchaseIds);
      if (update.error) throw new Error(update.error.message);
      await db.from("tasks").update({ status: "done" }).eq("case_id", ids.caseId);
      await db.from("cases").update({ status: "post_trip", next_action: "Cerrar expediente", blocker: null }).eq("id", ids.caseId);
      const preflight = await db.rpc("operational_close_preflight", { target_case: ids.caseId });
      if (preflight.error) throw new Error(preflight.error.message);
      const close = await db.rpc("close_operational_case", { target_case: ids.caseId, actor: actorId });
      if (close.error) throw new Error(close.error.message);
      const state = await db.from("cases").select("status,operational_closed_at,close_blockers").eq("id", ids.caseId).single();
      if (state.error) throw new Error(state.error.message);
      assert(Boolean(state.data.operational_closed_at), `not_closed:${JSON.stringify(close.data)}`);
      return { preflight: preflight.data, close: close.data, state: state.data };
    }));

    results.push(await test("Consultas Cliente 360, control e informes", async () => {
      const [client, caseData, proposal, purchases, payments, tasks, timeline] = await Promise.all([
        db.from("clients").select("id,display_name,email,phone").eq("id", ids.clientId).single(),
        db.from("cases").select("id,case_code,status,accepted_value,currency,operational_closed_at").eq("id", ids.caseId).single(),
        db.from("proposals").select("id,status,current_version_id").eq("id", proposalId).single(),
        db.from("expected_purchases").select("id,status,expected_amount").eq("case_id", ids.caseId),
        db.from("payments").select("id,status,amount").eq("case_id", ids.caseId),
        db.from("tasks").select("id,status").eq("case_id", ids.caseId),
        db.from("timeline_events").select("id,event_type").eq("case_id", ids.caseId),
      ]);
      for (const item of [client, caseData, proposal, purchases, payments, tasks, timeline]) if (item.error) throw new Error(item.error.message);
      return { client360: Boolean(client.data), caseControl: caseData.data, proposal: proposal.data, purchases: purchases.data?.length || 0, payments: payments.data?.length || 0, tasks: tasks.data?.length || 0, timeline: timeline.data?.length || 0 };
    }));
  } finally {
    const cleanupErrors: string[] = [];
    async function remove(label: string, operation: PromiseLike<{ error: { message?: string } | null }>) { try { const result = await operation; if (result.error) cleanupErrors.push(`${label}:${result.error.message || "failed"}`); } catch (error) { cleanupErrors.push(`${label}:${error instanceof Error ? error.message : "failed"}`); } }
    if (ids.followupId) await remove("followup", db.from("communication_followups").delete().eq("id", ids.followupId));
    if (ids.caseId) {
      await remove("tasks", db.from("tasks").delete().eq("case_id", ids.caseId));
      await remove("timeline", db.from("timeline_events").delete().eq("case_id", ids.caseId));
      await remove("audit", db.from("audit_log").delete().eq("entity_id", ids.caseId));
      await remove("case", db.from("cases").delete().eq("id", ids.caseId));
    }
    if (ids.clientId) {
      await remove("client_tasks", db.from("tasks").delete().eq("client_id", ids.clientId));
      await remove("client_timeline", db.from("timeline_events").delete().eq("client_id", ids.clientId));
      await remove("client_audit", db.from("audit_log").delete().eq("entity_id", ids.clientId));
      await remove("client", db.from("clients").delete().eq("id", ids.clientId));
    }
    results.push({ name: "Limpieza", ok: cleanupErrors.length === 0, details: { cleanupErrors } });
  }

  results.push(await test("Verificación de limpieza", async () => {
    const [clients, cases] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("source", "operational_audit_v3").eq("notes", runId),
      db.from("cases").select("id", { count: "exact", head: true }).eq("final_notes", runId),
    ]);
    if (clients.error || cases.error) throw new Error(clients.error?.message || cases.error?.message || "cleanup_check_failed");
    assert((clients.count || 0) + (cases.count || 0) === 0, "temporary_data_remaining");
    return { remaining: 0 };
  }));

  const failed = results.filter((item) => !item.ok);
  return NextResponse.json({ ok: failed.length === 0, runId, summary: { total: results.length, passed: results.length - failed.length, failed: failed.length }, results }, { status: failed.length ? 207 : 200 });
}
