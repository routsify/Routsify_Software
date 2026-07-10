import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPublicDemoAllowed, shouldBlockDemoInProduction } from "@/lib/runtime-mode";

const internalPagePrefixes = ["/hoy", "/clientes", "/expedientes", "/compras", "/informes", "/ajustes", "/buscar"];
const internalApiPrefixes = ["/api/routsify", "/api/documentos/upload-url", "/api/documentos/confirm-upload", "/api/payments/manual", "/api/health/internal"];

function isInternalProposal(pathname: string) {
  return pathname === "/propuestas";
}

function hasInternalToken(request: NextRequest) {
  const expected = process.env.ROUTSIFY_INTERNAL_API_TOKEN;
  const received = request.headers.get("x-routsify-internal-token");
  return Boolean(expected && received && expected === received);
}

function isProtectedPath(pathname: string) {
  return internalPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || isInternalProposal(pathname) || internalApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

async function hasValidSession(request: NextRequest, response: NextResponse) {
  const config = publicSupabaseConfig();
  if (!config) return false;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  return Boolean(!error && data.user);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const response = NextResponse.next({ request });
  const allowedByToken = hasInternalToken(request);
  const allowedByDemo = isPublicDemoAllowed() && !shouldBlockDemoInProduction();
  const allowedBySession = await hasValidSession(request, response);

  if (allowedByToken || allowedByDemo || allowedBySession) return response;

  if (isApi(pathname)) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/hoy/:path*", "/clientes/:path*", "/expedientes/:path*", "/propuestas", "/compras/:path*", "/informes/:path*", "/ajustes/:path*", "/buscar/:path*", "/api/routsify/:path*", "/api/documentos/upload-url", "/api/documentos/confirm-upload", "/api/payments/manual", "/api/health/internal"],
};
