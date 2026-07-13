import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicDemoAllowed } from "@/lib/runtime-mode";

const PUBLIC_PAGE_PREFIXES = ["/login", "/propuestas/"];
const PUBLIC_API_PREFIXES = ["/api/health", "/api/propuestas/", "/api/webhooks/", "/api/cron/"];
const PRIVATE_API_PREFIXES = ["/api/routsify", "/api/documentos/confirm-upload", "/api/documentos/upload-url", "/api/documentos/read-url", "/api/payments/"];

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

function isPublicPath(pathname: string) {
  return PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix)) || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPrivateApi(pathname: string) {
  return PRIVATE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const internalToken = request.headers.get("x-routsify-internal-token");
  if (internalToken && ["/api/health/internal", "/api/routsify/outbox/process", "/api/routsify/jobs/run"].includes(pathname)) return NextResponse.next();
  if (isPublicPath(pathname)) return NextResponse.next();
  if (isPublicDemoAllowed() && !isPrivateApi(pathname)) return NextResponse.next();

  const config = publicSupabaseConfig();
  if (!config) {
    if (isPrivateApi(pathname)) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value);
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) response.cookies.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return response;
  if (isPrivateApi(pathname)) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
