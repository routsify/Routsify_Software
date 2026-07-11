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

  const source = body as Record<string, unknown>;
  const clientId = String(source.client_id || "").trim();
  const destination = String(source.destination || "").trim();
  const tripStart = source.trip_start ? String(source.trip_start) : null;
  const tripEnd = source.trip_end ? String(source.trip_end) : null;
  if (!clientId || destination.length < 2) return NextResponse.json({ ok: false, error: "client_and_destination_required" }, { status: 400 });
  if (tripStart && tripEnd && tripStart > tripEnd) return NextResponse.json({ ok: false, error: "invalid_date_range" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await createCaseRepository({
    organization_id: organizationId,
    client_id: clientId,
    destination,
    title: String(source.title || destination).trim(),
    trip_start: tripStart,
    trip_end: tripEnd,
    final_notes: source.final_notes ? String(source.final_notes) : null,
    status: "new_lead",
    next_action: "Cualificar solicitud",
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
