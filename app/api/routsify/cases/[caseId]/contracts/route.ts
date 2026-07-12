import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

const statuses = new Set(["draft", "sent", "signed", "cancelled"]);

type ContractResult = {
  contract?: Record<string, unknown>;
  version?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  duplicate?: boolean;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function requestIpHash(request: NextRequest, organizationId: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const raw = forwarded || request.headers.get("x-real-ip") || "unknown";
  const salt = process.env.PROPOSAL_TOKEN_SECRET || process.env.ROUTSIFY_INTERNAL_API_TOKEN || organizationId;
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { caseId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  const status = text(body.status) || "draft";
  if (!statuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_contract_status" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const supabase = getSupabaseAdminClient();
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 });
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });

  const { data: latestContract, error: latestError } = await supabase
    .from("contracts")
    .select("id,status,current_version_id,external_url")
    .eq("organization_id", organizationId)
    .eq("case_id", caseId)
    .maybeSingle();
  if (latestError) return NextResponse.json({ ok: false, error: latestError.message }, { status: 400 });

  if (status === "cancelled") {
    if (!latestContract) return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 404 });
    if (latestContract.status === "signed") return NextResponse.json({ ok: false, error: "signed_contract_is_immutable" }, { status: 409 });
    const { data, error } = await supabase
      .from("contracts")
      .update({ status: "cancelled", notes: text(body.notes) || null, updated_at: new Date().toISOString() })
      .eq("id", latestContract.id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: caseId, event_type: "contract.cancelled", title: "Contrato cancelado", payload: { contract_id: data.id }, created_by: access.actorId });
    return NextResponse.json({ ok: true, data, contract: data });
  }

  const legalVersion = text(body.legal_version) || "v1.1";
  const externalUrl = text(body.external_url);
  const title = text(body.title) || "Contrato de viaje";
  const notes = text(body.notes);
  let contract = latestContract as Record<string, unknown> | null;
  let version: Record<string, unknown> | null = null;

  if (status !== "signed" || !latestContract?.current_version_id) {
    const initialStatus = status === "signed" ? "sent" : status;
    const { data: createData, error: createError } = await supabase.rpc("create_contract_version", {
      target_org: organizationId,
      target_case: caseId,
      contract_title: title,
      legal_version_value: legalVersion,
      external_url_value: externalUrl || null,
      notes_value: notes || null,
      contract_status_value: initialStatus,
      actor: access.actorId,
    });
    if (createError) return NextResponse.json({ ok: false, error: createError.message }, { status: 409 });
    const result = (createData || {}) as ContractResult;
    contract = result.contract || null;
    version = result.version || null;
  }

  if (status === "signed") {
    const contractId = text(contract?.id || latestContract?.id);
    if (!contractId) return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 404 });
    const signerName = text(body.signer_name);
    if (!signerName) return NextResponse.json({ ok: false, error: "signer_name_required" }, { status: 400 });
    if (body.review_confirmed !== true) return NextResponse.json({ ok: false, error: "contract_review_confirmation_required" }, { status: 400 });

    const { data: signatureData, error: signatureError } = await supabase.rpc("record_contract_signature", {
      target_org: organizationId,
      target_contract: contractId,
      signer_name_value: signerName,
      signer_email_value: text(body.signer_email) || null,
      ip_hash_value: requestIpHash(request, organizationId),
      user_agent_value: request.headers.get("user-agent") || null,
      evidence_value: {
        mode: "manual_external_confirmation",
        external_url: externalUrl || latestContract?.external_url || null,
        confirmed_by: access.actorId,
        reviewed_by_team: true,
      },
      review_confirmed: true,
      actor: access.actorId,
    });
    if (signatureError) return NextResponse.json({ ok: false, error: signatureError.message }, { status: 409 });
    const result = (signatureData || {}) as ContractResult;
    return NextResponse.json({ ok: true, data: result.contract, ...result });
  }

  return NextResponse.json({ ok: true, data: contract, contract, version }, { status: 201 });
}
