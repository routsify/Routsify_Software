import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createProposalToken, hashProposalToken } from "@/lib/proposal-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveOrganizationId, getRequestUserId } from "@/lib/request-context";

type RelationRow = Record<string, unknown>;

function firstRelation(value: unknown): RelationRow | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as RelationRow : null;
  return value && typeof value === "object" ? value as RelationRow : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => ({}));
  const requestedDays = Number((body as { validity_days?: unknown }).validity_days || 15);
  const validityDays = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 15, 1), 90);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const actorId = await getRequestUserId(request);
  const supabase = getSupabaseAdminClient();

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id,case_id,status,cases(id,case_code,title,destination,trip_start,trip_end,clients(display_name,email,phone))")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (proposalError) return NextResponse.json({ ok: false, error: proposalError.message }, { status: 400 });
  if (!proposal) return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  if (proposal.status === "accepted") return NextResponse.json({ ok: false, error: "accepted_proposal_locked" }, { status: 409 });

  const { data: version, error: versionError } = await supabase
    .from("proposal_versions")
    .select("id,version_number,total_sale,status,locked,snapshot")
    .eq("proposal_id", proposalId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 400 });
  if (!version) return NextResponse.json({ ok: false, error: "proposal_version_not_found" }, { status: 404 });
  if (version.locked) return NextResponse.json({ ok: false, error: "proposal_version_locked" }, { status: 409 });

  const { count, error: countError } = await supabase.from("budget_lines").select("id", { count: "exact", head: true }).eq("proposal_version_id", version.id);
  if (countError) return NextResponse.json({ ok: false, error: countError.message }, { status: 400 });
  if (!count || Number(version.total_sale || 0) <= 0) return NextResponse.json({ ok: false, error: "proposal_requires_priced_lines" }, { status: 400 });

  const caseRow = firstRelation(proposal.cases);
  const clientRow = firstRelation(caseRow?.clients);
  const clientName = String(clientRow?.display_name || "Cliente Routsify");
  const clientEmail = clientRow?.email ? String(clientRow.email) : null;
  const clientPhone = clientRow?.phone ? String(clientRow.phone) : null;
  const { count: travelersCount } = await supabase.from("travelers").select("id", { count: "exact", head: true }).eq("case_id", proposal.case_id).eq("organization_id", organizationId);
  const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
  const token = createProposalToken({ proposalId, versionId: version.id, expiresAt });
  const tokenHash = hashProposalToken(token);
  const now = new Date().toISOString();
  const snapshot = {
    ...(version.snapshot && typeof version.snapshot === "object" ? version.snapshot as Record<string, unknown> : {}),
    title: String(caseRow?.title || "Propuesta de viaje Routsify"),
    destination: String(caseRow?.destination || ""),
    client: clientName,
    travelers: travelersCount ? `${travelersCount} viajero${travelersCount === 1 ? "" : "s"}` : "Viajeros por confirmar",
    sent_at: now,
    valid_until: expiresAt.toISOString(),
  };

  const { error: versionUpdateError } = await supabase.from("proposal_versions").update({ status: "sent", snapshot, expires_at: expiresAt.toISOString() }).eq("id", version.id).eq("organization_id", organizationId);
  if (versionUpdateError) return NextResponse.json({ ok: false, error: versionUpdateError.message }, { status: 400 });
  const { error: proposalUpdateError } = await supabase.from("proposals").update({ status: "sent", current_version_id: version.id, public_token_hash: tokenHash, public_token_expires_at: expiresAt.toISOString(), updated_at: now }).eq("id", proposalId).eq("organization_id", organizationId);
  if (proposalUpdateError) return NextResponse.json({ ok: false, error: proposalUpdateError.message }, { status: 400 });

  await supabase.from("cases").update({ status: "proposal_sent", next_action: "Hacer seguimiento al cliente", updated_at: now }).eq("id", proposal.case_id).eq("organization_id", organizationId);
  await supabase.from("timeline_events").insert({ organization_id: organizationId, case_id: proposal.case_id, client_id: null, event_type: "proposal.sent", title: `Presupuesto v${version.version_number} preparado para envío`, payload: { proposal_id: proposalId, version_id: version.id, expires_at: expiresAt.toISOString(), recipient_email: clientEmail }, created_by: actorId });

  const origin = new URL(request.url).origin;
  const publicUrl = `${origin}/propuestas/${encodeURIComponent(token)}`;
  const message = `Hola ${clientName}, te compartimos tu propuesta de viaje Routsify: ${publicUrl}`;
  const whatsappPhone = String(clientPhone || "").replace(/\D/g, "");
  return NextResponse.json({
    ok: true,
    data: {
      url: publicUrl,
      expires_at: expiresAt.toISOString(),
      email: clientEmail,
      phone: clientPhone,
      mailto_url: clientEmail ? `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent("Tu propuesta de viaje Routsify")}&body=${encodeURIComponent(message)}` : null,
      whatsapp_url: whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}` : null,
    },
  });
}