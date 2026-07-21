import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { documentId } = await params;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = String(body?.action || "").trim().toLowerCase();
  if (!new Set(["activate", "archive"]).has(action)) return NextResponse.json({ ok: false, error: "invalid_legal_document_action" }, { status: 400 });
  const { data, error } = await getSupabaseAdminClient().rpc("set_legal_document_state", {
    target_org: access.organizationId,
    target_document: documentId,
    action_value: action,
    actor: access.actorId,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data }, { headers: { "cache-control": "private, no-store" } });
}
