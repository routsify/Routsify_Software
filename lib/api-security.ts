import { timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission, type AppPermission } from "@/lib/rbac";
import type { AppRole } from "@/lib/settings-master";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export type { AppRole } from "@/lib/settings-master";

export type ApiAccessContext =
  | { ok: true; mode: "authenticated" | "internal_token"; organizationId: string; actorId: string; role: AppRole }
  | { ok: false; status: number; error: string };

const INTERNAL_TOKEN_PATHS = new Set([
  "/api/health/internal",
  "/api/routsify/outbox/process",
  "/api/routsify/jobs/run",
]);

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

function constantTimeEqual(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function hasValidInternalToken(request: NextRequest) {
  const expected = process.env.ROUTSIFY_INTERNAL_API_TOKEN || "";
  const received = request.headers.get("x-routsify-internal-token") || "";
  return Boolean(expected && received && constantTimeEqual(expected, received));
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function requiredPermission(request: NextRequest): AppPermission {
  const path = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const isRead = method === "GET" || method === "HEAD";

  if (path === "/api/routsify/settings/integrations/health" && isRead) return "settings.view";
  if (path.startsWith("/api/routsify/settings/secrets") || path.startsWith("/api/routsify/settings/integrations")) return "settings.secrets.manage";
  if (path.startsWith("/api/routsify/settings")) return isRead ? "settings.view" : "settings.manage";
  if (path.startsWith("/api/routsify/system") || path.startsWith("/api/routsify/outbox")) return "system.manage";
  if (path.startsWith("/api/routsify/communications/templates")) return isRead ? "communications.view" : "communications.templates.manage";
  if (path.startsWith("/api/routsify/communications")) return isRead ? "communications.view" : "communications.manage";
  if (path.startsWith("/api/routsify/payment-links") || path.includes("/payment-link")) return "payment_links.manage";
  if (path.startsWith("/api/payments") || path.includes("/fiscal")) return "payments.manage";
  if (path.startsWith("/api/routsify/proposals") || path.startsWith("/api/routsify/budgets")) return isRead ? "budgets.view" : "budgets.manage";
  if (path.startsWith("/api/routsify/documents") || path.startsWith("/api/routsify/ocr") || path.startsWith("/api/documentos")) return "documents.manage";
  if (path.startsWith("/api/routsify/suppliers")) return isRead ? "suppliers.view" : "suppliers.manage";
  if (path.startsWith("/api/routsify/expected-purchases")) return isRead ? "purchases.view" : "purchases.manage";
  if (path.includes("/travelers") || path.includes("/contracts")) return isRead ? "operations.sensitive.view" : "operations.sensitive.manage";
  if (path.includes("/tasks") || path.includes("/timeline")) return isRead ? "tasks.view" : "tasks.manage";
  if (path.startsWith("/api/routsify/reports")) return "reports.view";
  if (path.startsWith("/api/routsify/leads")) return isRead ? "clients.view" : "clients.manage";
  if (path.startsWith("/api/routsify/clients")) return isRead ? "clients.view" : "clients.manage";
  if (path.startsWith("/api/routsify/cases")) return isRead ? "cases.view" : "cases.manage";
  return isRead ? "app.view" : "system.manage";
}

async function authenticatedUser(request: NextRequest) {
  const config = publicSupabaseConfig();
  if (!config || !hasSupabaseAdminEnv()) return null;
  const token = bearerToken(request);
  let userId: string | null = null;
  if (token) {
    const { data, error } = await getSupabaseAdminClient().auth.getUser(token);
    if (!error && data.user) userId = data.user.id;
  } else {
    const supabase = createServerClient(config.url, config.key, {
      cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} },
    });
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) userId = data.user.id;
  }
  if (!userId) return null;
  const { data: profile, error } = await getSupabaseAdminClient().from("profiles").select("organization_id,role").eq("user_id", userId).maybeSingle();
  if (error || !profile?.organization_id) return null;
  return { userId, organizationId: String(profile.organization_id), role: String(profile.role || "viewer") as AppRole };
}

export async function requireInternalAccess(request: NextRequest): Promise<ApiAccessContext> {
  const path = request.nextUrl.pathname;
  if (hasValidInternalToken(request)) {
    if (!INTERNAL_TOKEN_PATHS.has(path)) return { ok: false, status: 403, error: "internal_token_scope_denied" };
    const organizationId = process.env.ROUTSIFY_DEFAULT_ORGANIZATION_ID || "";
    if (!organizationId && path !== "/api/health/internal") return { ok: false, status: 503, error: "default_organization_not_configured" };
    return { ok: true, mode: "internal_token", organizationId, actorId: "internal", role: "admin" };
  }
  const user = await authenticatedUser(request);
  if (!user) return { ok: false, status: 401, error: "authentication_required" };
  if (!hasPermission(user.role, requiredPermission(request))) return { ok: false, status: 403, error: "insufficient_role" };
  return { ok: true, mode: "authenticated", organizationId: user.organizationId, actorId: user.userId, role: user.role };
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
