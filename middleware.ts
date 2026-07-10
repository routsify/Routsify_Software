import { NextRequest, NextResponse } from "next/server";
import { isPublicDemoAllowed, shouldBlockDemoInProduction } from "@/lib/runtime-mode";

const internalPagePrefixes = ["/hoy", "/clientes", "/expedientes", "/compras", "/informes", "/ajustes"];
const internalApiPrefixes = ["/api/routsify", "/api/documentos/upload-url", "/api/documentos/confirm-upload", "/api/payments/manual", "/api/health/internal"];

function isInternalProposal(pathname: string) {
  return pathname === "/propuestas";
}

function hasSessionLikeCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") || cookie.name.includes("supabase") || cookie.name === "routsify_session");
}

function hasBearerToken(request: NextRequest) {
  return (request.headers.get("authorization") || "").toLowerCase().startsWith("bearer ");
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const allowed = hasSessionLikeCookie(request) || hasBearerToken(request) || hasInternalToken(request) || isPublicDemoAllowed();
  if (allowed && !shouldBlockDemoInProduction()) return NextResponse.next();

  if (isApi(pathname)) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/hoy/:path*", "/clientes/:path*", "/expedientes/:path*", "/propuestas", "/compras/:path*", "/informes/:path*", "/ajustes/:path*", "/api/routsify/:path*", "/api/documentos/upload-url", "/api/documentos/confirm-upload", "/api/payments/manual", "/api/health/internal"],
};
