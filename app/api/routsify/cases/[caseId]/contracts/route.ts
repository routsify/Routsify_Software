import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { loadEffectiveSettings } from "@/lib/effective-settings-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

const statuses = new Set(["draft", "sent", "signed", "cancelled"]);
const DEFAULT_LEGAL_VERSION = "Routsify-2026.1";

type JsonRow = Record<string, unknown>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function hasBillingAddress(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object" && "address" in value) {
    return text((value as { address?: unknown }).address).length > 0;
  }
  return false;
}

function firstRelation(value: unknown): JsonRow | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as JsonRow : null;
  return value && typeof value === "object" ? value as JsonRow : null;
}

function rpcContract(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return firstRelation((value as JsonRow).contract);
}

function requestEvidence(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return {
    ipHash: createHash("sha256").update(ip).digest("hex"),
    userAgent: text(request.headers.get("user-agent")).slice(0, 500),
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { caseId } = await params;
  const body = await request.json().catch(() => null) as JsonRow | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const status = text(body.status) || "draft";
  if (!statuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_contract_status" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const [actorId, settings] = await Promise.all([
    getRequestUserId(request),
    loadEffectiveSettings(organizationId),
  ]);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id,client_id,accepted_value,status,clients(display_name,email,tax_id,billing_address)")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const requestedContractId = text(body.id);
  let existingQuery = supabase
    .from("contracts")
    .select("id,status,signed_at,legal_version,current_version_id,title,external_url,notes")
    .eq("organization_id", organizationId)
    .eq("case_id", caseId);
  if (requestedContractId) existingQuery = existingQuery.eq("id", requestedContractId);
  const { data: existingContract, error: existingError } = await existingQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (requestedContractId && !existingContract) return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 404 });
  if (existingContract?.status === "signed" && status !== "signed") {
    return NextResponse.json({ ok: false, error: "signed_contract_is_immutable" }, { status: 409 });
  }

  const title = text(body.title || existingContract?.title) || "Contrato de viaje";
  const externalUrl = text(body.external_url || existingContract?.external_url);
  const notes = text(body.notes || existingContract?.notes);
  const legalVersion = text(body.legal_version || existingContract?.legal_version) || DEFAULT_LEGAL_VERSION;

  if (["sent", "signed"].includes(status)) {
    if (!externalUrl) return NextResponse.json({ ok: false, error: "contract_url_required_before_send" }, { status: 400 });

    const acceptedValue = Number(caseRow.accepted_value || 0);
    const { data: accepted } = await supabase
      .from("proposals")
      .select("id,current_version_id")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle();
    if (!accepted?.current_version_id || acceptedValue <= 0) {
      return NextResponse.json({ ok: false, error: "accepted_proposal_required" }, { status: 409 });
    }

    const client = firstRelation(caseRow.clients);
    const mustBlockMissingFiscal = settings.boolean("contracts.block_missing_fiscal", true) && settings.boolean("clients.fiscal.required", true);
    if (mustBlockMissingFiscal) {
      const fiscalComplete = Boolean(text(client?.tax_id)) && hasBillingAddress(client?.billing_address);
      if (!fiscalComplete) return NextResponse.json({ ok: false, error: "client_fiscal_data_required" }, { status: 409 });
    }

    try {
      let contract = existingContract as JsonRow | null;
      if (status === "sent" || !existingContract?.current_version_id) {
        const { data: versioned, error: versionError } = await supabase.rpc("create_contract_version", {
          target_org: organizationId,
          target_case: caseId,
          contract_title: title,
          legal_version_value: legalVersion,
          external_url_value: externalUrl,
          notes_value: notes,
          contract_status_value: "sent",
          actor: actorId,
        });
        if (versionError) throw new Error(versionError.message);
        contract = rpcContract(versioned);
      }

      if (status === "signed") {
        if (body.review_confirmed !== true) {
          return NextResponse.json({ ok: false, error: "contract_review_confirmation_required" }, { status: 400 });
        }
        const contractId = text(contract?.id || existingContract?.id);
        if (!contractId) throw new Error("contract_not_found");
        const signerName = text(body.signer_name || client?.display_name);
        const signerEmail = text(body.signer_email || client?.email).toLowerCase();
        if (!signerName) return NextResponse.json({ ok: false, error: "signer_name_required" }, { status: 400 });
        if (signerEmail && !/^\S+@\S+\.\S+$/.test(signerEmail)) return NextResponse.json({ ok: false, error: "invalid_signer_email" }, { status: 400 });

        const evidence = requestEvidence(request);
        const { data: signed, error: signatureError } = await supabase.rpc("record_contract_signature", {
          target_org: organizationId,
          target_contract: contractId,
          signer_name_value: signerName,
          signer_email_value: signerEmail,
          ip_hash_value: evidence.ipHash,
          user_agent_value: evidence.userAgent,
          evidence_value: {
            source: "routsify_admin_manual_confirmation",
            external_url: externalUrl,
            legal_version: legalVersion,
            confirmation_note: notes || null,
          },
          review_confirmed: true,
          actor: actorId,
        });
        if (signatureError) throw new Error(signatureError.message);
        contract = rpcContract(signed);
        const now = new Date().toISOString();
        await supabase.from("tasks")
          .update({ status: "done", updated_at: now })
          .eq("organization_id", organizationId)
          .eq("case_id", caseId)
          .eq("status", "pending")
          .eq("title", "Preparar contrato y solicitar documentación");
      }

      if (!contract) throw new Error("contract_workflow_returned_no_contract");
      return NextResponse.json({ ok: true, data: contract });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "contract_workflow_failed" }, { status: 409 });
    }
  }

  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    case_id: caseId,
    title,
    status,
    external_url: externalUrl || null,
    legal_version: legalVersion,
    notes: notes || null,
    signed_at: null,
    updated_at: now,
  };
  const query = existingContract
    ? supabase.from("contracts").update(payload).eq("id", existingContract.id).eq("organization_id", organizationId).eq("case_id", caseId)
    : supabase.from("contracts").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  if (status === "cancelled") {
    await supabase.from("tasks")
      .update({ status: "cancelled", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("case_id", caseId)
      .eq("status", "pending")
      .eq("title", "Preparar contrato y solicitar documentación");
  }
  if (!existingContract || existingContract.status !== status) {
    await supabase.from("timeline_events").insert({
      organization_id: organizationId,
      case_id: caseId,
      event_type: `contract.${status}`,
      title: `Contrato actualizado: ${status}`,
      payload: { contract_id: data.id },
      created_by: actorId,
    });
  }
  return NextResponse.json({ ok: true, data });
}
