import { NextRequest, NextResponse } from "next/server";

export type ApiAccessContext = {
  ok: true;
  mode: "authenticated" | "internal_token";
  organizationId: string;
  actorId: string;
  role: "admin" | "direction" | "sales" | "operations" | "billing" | "viewer";
} | {
  ok: false;
  status: number;
  error: string;
};

function hasSessionLikeCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") || cookie.name.includes("supabase") || cookie.name === "routsify_session");
}

function hasBearerToken(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") && value.length > 20;
}

function hasInternalToken(request: NextRequest) {
  const expected = process.env.ROUTSIFY_INTERNAL_API_TOKEN;
  const received = request.headers.get("x-routsify-internal-token");
  return Boolean(expected && received && expected === received);
}

function productionOrganizationFallback() {
  return process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
}

export function requireInternalAccess(request: NextRequest): ApiAccessContext {
  const fallbackOrganizationId = productionOrganizationFallback();
  if (hasInternalToken(request)) return { ok: true, mode: "internal_token", organizationId: fallbackOrganizationId, actorId: "internal", role: "admin" };
  if (hasSessionLikeCookie(request) || hasBearerToken(request)) return { ok: true, mode: "authenticated", organizationId: fallbackOrganizationId, actorId: "session", role: "admin" };
  return { ok: false, status: 401, error: "authentication_required" };
}

export function jsonAccessDenied(context: Extract<ApiAccessContext, { ok: false }>) {
  return NextResponse.json({ ok: false, error: context.error }, { status: context.status });
}

export function sanitizeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120);
}

export function validatePrivateUpload(input: { caseCode?: string; fileName?: string; sizeBytes?: number; mimeType?: string }) {
  if (!input.caseCode || !/^EXP-[0-9]{4}-[0-9]{4}$/.test(input.caseCode)) return "invalid_case_code";
  if (!input.fileName || sanitizeFileName(input.fileName).length < 3) return "invalid_file_name";
  const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
  const fileName = input.fileName.toLowerCase();
  if (!allowedExtensions.some((extension) => fileName.endsWith(extension))) return "unsupported_file_type";
  if (input.sizeBytes && input.sizeBytes > 10 * 1024 * 1024) return "file_too_large";
  return null;
}
