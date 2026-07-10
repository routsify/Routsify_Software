import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { createClientRepository, listClientsRepository } from "@/lib/server-repositories";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

async function resolveOrganizationId(request: NextRequest, fallback: string) {
  if (!hasSupabaseAdminEnv()) return fallback;
  const config = publicSupabaseConfig();
  if (!config) return fallback;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll() {},
    },
  });

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return fallback;

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  if (profile?.organization_id) return profile.organization_id;

  const { data: org } = await admin.from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return org?.id || fallback;
}

export async function GET(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const result = await listClientsRepository();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const access = requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const displayName = String(body.display_name || body.name || "").trim();
  if (displayName.length < 2) return NextResponse.json({ ok: false, error: "client_name_required" }, { status: 400 });

  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const result = await createClientRepository({ ...body, display_name: displayName, organization_id: organizationId });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
