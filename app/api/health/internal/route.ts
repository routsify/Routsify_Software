import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { hasSupabaseBrowserEnv } from "@/lib/supabase-browser";
import { appModules, moduleSummary } from "@/lib/navigation";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);

  const modules = moduleSummary(appModules);
  return NextResponse.json({
    ok: true,
    accessMode: access.mode,
    app: process.env.NEXT_PUBLIC_APP_NAME || "Routsify Software",
    runtimeMode: "production",
    deployTarget: process.env.VERCEL ? "vercel" : "unknown",
    publicUrl: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || null,
    supabasePublicConfigured: hasSupabaseBrowserEnv(),
    supabaseAdminConfigured: hasSupabaseAdminEnv(),
    proposalTokensConfigured: Boolean(process.env.PROPOSAL_TOKEN_SECRET),
    webhooksHmacConfigured: Boolean(process.env.FORM_WEBHOOK_SECRET && process.env.BOOKING_WEBHOOK_SECRET),
    internalApiTokenConfigured: Boolean(process.env.ROUTSIFY_INTERNAL_API_TOKEN),
    holdedConfigured: Boolean(process.env.HOLDED_API_KEY),
    modules,
    timestamp: new Date().toISOString(),
  });
}
