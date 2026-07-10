import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createCaseRepository, listCasesRepository } from "@/lib/server-repositories";
import { resolveOrganizationId } from "@/lib/request-context";

export async function GET(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const result = await listCasesRepository();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const clientName = String(body.client_name || body.clientName || "").trim();
  const destination = String(body.destination || "").trim();
  if (clientName.length < 2 || destination.length < 2) return NextResponse.json({ ok: false, error: "required_fields" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await createCaseRepository({
    organization_id: organizationId,
    client_name: clientName,
    destination,
    title: body.title || destination,
    trip_start: body.trip_start || body.startDate || null,
    trip_end: body.trip_end || body.endDate || null,
    final_notes: body.final_notes || body.notes || null,
    status: "new_lead",
    next_action: "Revisar expediente",
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
