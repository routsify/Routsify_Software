import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createOrUpdateManualPaymentLink } from "@/lib/payment-workflow-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId } from "@/lib/request-context";

export async function GET(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const { data: proposal } = await getSupabaseAdminClient().from("proposals").select("case_id,current_version_id").eq("id", proposalId).eq("organization_id", organizationId).maybeSingle();
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  const { data, error } = await getSupabaseAdminClient().from("payment_links").select("*").eq("organization_id", organizationId).eq("case_id", proposal.case_id).eq("proposal_version_id", proposal.current_version_id).order("created_at", { ascending: false });
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  const externalUrl = String(body?.external_url || "").trim();
  if (!externalUrl) return NextResponse.json({ ok: false, error: "payment_url_required" }, { status: 400 });
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  try {
    const data = await createOrUpdateManualPaymentLink({ organizationId, proposalId, externalUrl, amount: Number(body?.amount || 0) || undefined, actorId: access.actorId, paymentLinkId: body?.id ? String(body.id) : null });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment_link_save_failed";
    return NextResponse.json({ ok: false, error: message }, { status: message === "proposal_not_found" ? 404 : 400 });
  }
}
