import { NextResponse } from "next/server";
import { hasSupabaseAdminEnv } from "@/lib/supabase-admin";
import { hasSupabaseBrowserEnv, isDemoMode } from "@/lib/supabase-browser";
import { appModules, moduleSummary } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const modules = moduleSummary(appModules);
  return NextResponse.json({
    ok: true,
    app: process.env.NEXT_PUBLIC_APP_NAME || "Routsify Software",
    demoMode: isDemoMode(),
    deployTarget: process.env.NETLIFY ? "netlify" : "unknown",
    publicUrl: process.env.URL || process.env.NEXT_PUBLIC_APP_URL || null,
    supabasePublicConfigured: hasSupabaseBrowserEnv(),
    supabaseAdminConfigured: hasSupabaseAdminEnv(),
    proposalTokensConfigured: Boolean(process.env.PROPOSAL_TOKEN_SECRET),
    holdedConfigured: Boolean(process.env.HOLDED_API_KEY),
    modules,
    timestamp: new Date().toISOString(),
  });
}
