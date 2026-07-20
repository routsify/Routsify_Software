import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function numeric(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }

export async function createOrUpdateManualPaymentLink(input: {
  organizationId: string;
  proposalId: string;
  externalUrl: string;
  amount?: number;
  actorId: string;
  paymentLinkId?: string | null;
}) {
  let parsed: URL;
  try { parsed = new URL(input.externalUrl); } catch { throw new Error("invalid_payment_url"); }
  if (parsed.protocol !== "https:") throw new Error("payment_url_must_use_https");
  const supabase = getSupabaseAdminClient();
  const { data: proposal, error } = await supabase.from("proposals")
    .select("id,status,current_version_id,case_id,proposal_versions!proposals_current_version_fk(id,total_sale,locked),cases(id,accepted_value,currency)")
    .eq("id", input.proposalId).eq("organization_id", input.organizationId).maybeSingle();
  if (error || !proposal) throw new Error(error?.message || "proposal_not_found");
  if (proposal.status !== "accepted" || !proposal.current_version_id) throw new Error("proposal_must_be_accepted");
  const version = Array.isArray(proposal.proposal_versions) ? proposal.proposal_versions[0] : proposal.proposal_versions;
  if (!version?.locked) throw new Error("accepted_version_must_be_locked");
  const caseRow = Array.isArray(proposal.cases) ? proposal.cases[0] : proposal.cases;
  const amount = input.amount && input.amount > 0 ? input.amount : numeric(version.total_sale || caseRow?.accepted_value);
  if (amount <= 0) throw new Error("payment_amount_required");
  const now = new Date().toISOString();
  const tokenHash = createHash("sha256").update(`${input.organizationId}:${proposal.case_id}:${proposal.current_version_id}:${input.externalUrl}`).digest("hex");
  const payload = {
    organization_id: input.organizationId,
    case_id: proposal.case_id,
    proposal_version_id: proposal.current_version_id,
    provider: "teya_manual",
    external_url: input.externalUrl,
    token_hash: tokenHash,
    amount,
    currency: String(caseRow?.currency || "EUR"),
    status: "created",
    created_by: input.actorId,
    updated_at: now,
  };
  const query = input.paymentLinkId
    ? supabase.from("payment_links").update(payload).eq("id", input.paymentLinkId).eq("organization_id", input.organizationId).eq("case_id", proposal.case_id)
    : supabase.from("payment_links").insert(payload);
  const { data, error: writeError } = await query.select("*").single();
  if (writeError) throw new Error(writeError.message);
  await supabase.from("timeline_events").insert({ organization_id: input.organizationId, case_id: proposal.case_id, event_type: "payment_link.saved", title: "Enlace de pago Teya guardado", payload: { payment_link_id: data.id, proposal_version_id: proposal.current_version_id, amount }, created_by: input.actorId });
  return data;
}

export async function confirmManualPaymentLink(input: {
  organizationId: string;
  paymentLinkId: string;
  reference: string;
  amount?: number;
  receivedAt?: string;
  actorId: string;
  notes?: string | null;
}) {
  const reference = input.reference.trim();
  if (!reference) throw new Error("payment_reference_required");
  const supabase = getSupabaseAdminClient();
  const { data: link, error } = await supabase.from("payment_links").select("*, cases(id,accepted_value,currency)").eq("id", input.paymentLinkId).eq("organization_id", input.organizationId).maybeSingle();
  if (error || !link) throw new Error(error?.message || "payment_link_not_found");
  if (link.status === "confirmed") {
    const { data: existing } = await supabase.from("payments").select("*").eq("payment_link_id", link.id).eq("organization_id", input.organizationId).maybeSingle();
    return { payment: existing, paymentLink: link, duplicate: true };
  }
  const caseRow = Array.isArray(link.cases) ? link.cases[0] : link.cases;
  const amount = input.amount && input.amount > 0 ? input.amount : numeric(link.amount || caseRow?.accepted_value);
  if (amount <= 0) throw new Error("payment_amount_required");
  const receivedAt = input.receivedAt ? new Date(input.receivedAt).toISOString() : new Date().toISOString();
  const { data: result, error: rpcError } = await supabase.rpc("confirm_external_payment", {
    target_org: input.organizationId,
    target_case: link.case_id,
    transaction_value: reference,
    payment_reference_value: reference,
    amount_value: amount,
    currency_value: String(link.currency || caseRow?.currency || "EUR"),
    provider_value: "teya_manual",
    confirmed_timestamp: receivedAt,
    payment_payload: { notes: input.notes || null, actor_id: input.actorId, confirmation_mode: "manual", payment_link_id: link.id },
  });
  if (rpcError) throw new Error(rpcError.message);
  const now = new Date().toISOString();
  await supabase.from("payment_links").update({ status: "confirmed", confirmed_at: receivedAt, updated_at: now }).eq("id", link.id).eq("organization_id", input.organizationId);
  await supabase.from("payments").update({ payment_link_id: link.id, source: "manual", confirmed_by: input.actorId, updated_at: now }).eq("organization_id", input.organizationId).eq("case_id", link.case_id).eq("payment_reference", reference);
  return { payment: result, paymentLink: { ...link, status: "confirmed", confirmed_at: receivedAt }, duplicate: false };
}
