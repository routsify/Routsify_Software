import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { getRequestUserId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const STATUSES = new Set(["open", "monitoring", "resolved"]);

function text(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function timestamp(value: unknown) {
  const raw = text(value, 50);
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const source = body as Record<string, unknown>;
  const title = text(source.title, 200);
  const severity = text(source.severity, 20) || "medium";
  const status = text(source.status, 20) || "open";
  const occurredAt = timestamp(source.occurred_at);
  const caseId = text(source.case_id, 50) || null;

  if (title.length < 2) return NextResponse.json({ ok: false, error: "incident_title_required" }, { status: 400 });
  if (!SEVERITIES.has(severity)) return NextResponse.json({ ok: false, error: "invalid_incident_severity" }, { status: 400 });
  if (!STATUSES.has(status)) return NextResponse.json({ ok: false, error: "invalid_incident_status" }, { status: 400 });
  if (!occurredAt) return NextResponse.json({ ok: false, error: "invalid_incident_date" }, { status: 400 });

  const { supplierId } = await params;
  const db = getSupabaseAdminClient();
  const { data: supplier } = await db.from("suppliers").select("id").eq("id", supplierId).eq("organization_id", access.organizationId).maybeSingle();
  if (!supplier) return NextResponse.json({ ok: false, error: "supplier_not_found" }, { status: 404 });

  if (caseId) {
    const { data: caseRow } = await db.from("cases").select("id").eq("id", caseId).eq("organization_id", access.organizationId).maybeSingle();
    if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 });
  }

  const actorId = await getRequestUserId(request);
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  const { data, error } = await db.from("supplier_incidents").insert({
    organization_id: access.organizationId,
    supplier_id: supplierId,
    case_id: caseId,
    severity,
    status,
    title,
    description: text(source.description, 5000) || null,
    occurred_at: occurredAt,
    resolved_at: resolvedAt,
    created_by: actorId,
  }).select("id,supplier_id,case_id,severity,status,title,description,occurred_at,resolved_at,created_at,updated_at,cases(case_code,destination)").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await db.from("audit_log").insert({ organization_id: access.organizationId, actor_id: actorId, entity_type: "supplier_incident", entity_id: data.id, action: "supplier_incident.created", after_data: data });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
