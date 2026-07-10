import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { updateCaseRepository } from "@/lib/server-repositories";

const allowedStatuses = new Set(["new_lead", "budget_draft", "proposal_sent", "accepted", "in_progress", "closed", "presupuesto_en_preparacion", "presupuesto_enviado", "presupuesto_aceptado", "cerrado"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const { caseId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of ["title", "destination", "trip_start", "trip_end", "next_action", "blocker", "final_notes"]) {
    if (key in body) updates[key] = body[key] || null;
  }
  if ("status" in body) {
    const status = String(body.status || "");
    if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    updates.status = status;
  }

  const result = await updateCaseRepository(caseId, updates);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
