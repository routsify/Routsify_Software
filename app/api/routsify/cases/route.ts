import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { listCaseDirectoryPage } from "@/lib/case-directory-server";
import { createConfiguredCase } from "@/lib/case-creation-server";
import { listOrganizationCases } from "@/lib/organization-repositories";
import { resolveOrganizationId } from "@/lib/request-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  if (request.nextUrl.searchParams.get("paginated") === "1") {
    try {
      const params = request.nextUrl.searchParams;
      const data = await listCaseDirectoryPage(organizationId, {
        page: Number(params.get("page") || 1),
        pageSize: Number(params.get("pageSize") || 50),
        query: params.get("q") || "",
        status: params.get("status") || "active",
        health: params.get("health") || "all",
      });
      return NextResponse.json({ ok: true, data });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "case_directory_failed" }, { status: 400 });
    }
  }
  const result = await listOrganizationCases(organizationId);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
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
  const { data: client } = await getSupabaseAdminClient().from("clients").select("id").eq("id", clientId).eq("organization_id", organizationId).maybeSingle();
  if (!client) return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });

  const result = await createConfiguredCase({
    organizationId,
    clientId,
    destination,
    title: String(source.title || destination).trim(),
    tripStart,
    tripEnd,
    finalNotes: source.final_notes ? String(source.final_notes) : null,
    requestedCurrency: source.currency,
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
