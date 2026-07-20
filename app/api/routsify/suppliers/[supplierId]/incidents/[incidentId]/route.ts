import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getRequestUserId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const STATUSES = new Set(["open", "monitoring", "resolved"]);

function text(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ supplierId: string; incidentId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const { supplierId, incidentId } = await params;
  const source = body as Record<string, unknown>;
  const db = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await db
    .from("supplier_incidents")
    .select("*")
    .eq("id", incidentId)
    .eq("supplier_id", supplierId)
    .eq("organization_id", access.organizationId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ ok: false, error: "supplier_incident_not_found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in source) {
    const title = text(source.title, 200);
    if (title.length < 2) return NextResponse.json({ ok: false, error: "incident_title_required" }, { status: 400 });
    patch.title = title;
  }
  if ("description" in source) patch.description = text(source.description) || null;
  if ("severity" in source) {
    const severity = text(source.severity, 20);
    if (!SEVERITIES.has(severity)) return NextResponse.json({ ok: false, error: "invalid_incident_severity" }, { status: 400 });
    patch.severity = severity;
  }
  if ("status" in source) {
    const status = text(source.status, 20);
    if (!STATUSES.has(status)) return NextResponse.json({ ok: false, error: "invalid_incident_status" }, { status: 400 });
    patch.status = status;
    patch.resolved_at = status === "resolved" ? existing.resolved_at || new Date().toISOString() : null;
  }

  const { data, error } = await db
    .from("supplier_incidents")
    .update(patch)
    .eq("id", incidentId)
    .eq("supplier_id", supplierId)
    .eq("organization_id", access.organizationId)
    .select("id,supplier_id,case_id,severity,status,title,description,occurred_at,resolved_at,created_at,updated_at,cases(case_code,destination)")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const actorId = await getRequestUserId(request);
  await db.from("audit_log").insert({ organization_id: access.organizationId, actor_id: actorId, entity_type: "supplier_incident", entity_id: incidentId, action: "supplier_incident.updated", before_data: existing, after_data: data });
  return NextResponse.json({ ok: true, data });
}
