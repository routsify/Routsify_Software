import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const requiredFiles = [
  "middleware.ts",
  "app/page.tsx",
  "app/login/page.tsx",
  "app/login/LoginForm.tsx",
  "lib/runtime-mode.ts",
  "lib/supabase-browser.ts",
  "lib/webhook-security.ts",
  "lib/proposal-public-server.ts",
  "lib/server-repositories.ts",
  "lib/outbox-worker-server.ts",
  "app/api/health/route.ts",
  "app/api/health/internal/route.ts",
  "app/api/documentos/upload-url/route.ts",
  "app/api/documentos/confirm-upload/route.ts",
  "app/api/payments/manual/route.ts",
  "app/api/routsify/outbox/process/route.ts",
  "app/api/propuestas/[token]/accept/route.ts",
  "supabase/migrations/0001_routsify_mvp_schema.sql",
  "supabase/migrations/0002_routsify_mvp_rls_audit_storage.sql",
  "supabase/migrations/0003_routsify_mvp_integration_hardening.sql",
  "supabase/migrations/0004_routsify_mvp_security_model_hardening.sql",
  "supabase/migrations/0005_routsify_settings_and_outbox_worker.sql",
  "components/AppShell.tsx",
  "lib/navigation.ts"
];

for (const file of requiredFiles) assert(existsSync(join(root, file)), `Missing required file: ${file}`);

const pkg = read("package.json");
assert(!pkg.includes('"latest"'), "Dependencies must not use latest");

const home = read("app/page.tsx");
assert(home.includes('redirect("/login")'), "Root must redirect to /login");

const runtime = read("lib/runtime-mode.ts");
assert(runtime.includes('NEXT_PUBLIC_DEMO_MODE === "true"'), "Server demo mode must be explicit");
assert(runtime.includes('ROUTSIFY_ALLOW_PUBLIC_DEMO === "true"'), "Server public demo must be explicit");
assert(!runtime.includes('ROUTSIFY_ALLOW_PUBLIC_DEMO !== "false"'), "Public demo must not be allowed by default");

const browser = read("lib/supabase-browser.ts");
assert(browser.includes("createBrowserClient"), "Browser auth must use Supabase SSR browser client for cookies");
assert(browser.includes('NEXT_PUBLIC_DEMO_MODE === "true"'), "Browser demo mode must be explicit");
assert(browser.includes('NEXT_PUBLIC_ALLOW_PUBLIC_DEMO === "true"'), "Browser demo button must be explicit");

const middleware = read("middleware.ts");
for (const token of ["/api/routsify", "/api/documentos/confirm-upload", "authentication_required", "isPublicDemoAllowed"]) assert(middleware.includes(token), `Missing middleware token: ${token}`);

const login = read("app/login/LoginForm.tsx");
for (const token of ["signInWithPassword", "ensure_profile_for_current_user", "resetPasswordForEmail", "He olvidado mi contraseña", "showSecret", "safeNext"]) assert(login.includes(token), `Missing login token: ${token}`);
assert(!login.includes("disabled={!canUseAuth}"), "Login inputs must stay writable even when platform env is missing");
assert(!login.includes("Puedes entrar sin usuario con el botón Entrar en demo"), "Login must not suggest demo by default");

const loginPage = read("app/login/page.tsx");
for (const token of ["Recuperación por email", "Sesión compatible con middleware", "Demo solo si se activa explícitamente"]) assert(loginPage.includes(token), `Missing login page token: ${token}`);

const nav = read("lib/navigation.ts");
for (const label of ["Inicio", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Informes", "Ajustes"]) assert(nav.includes(label), `Missing module: ${label}`);
assert(!nav.includes("/viajeros"), "Travelers must not be a canonical module");
assert(!nav.includes("/contratos"), "Contracts must not be a canonical module");

const appShell = read("components/AppShell.tsx");
for (const removed of ["Viajeros y Documentos", "Contrato, Firma y Pago", "demo-public-token"]) assert(!appShell.includes(removed), `Removed item still visible: ${removed}`);

const publicProposal = read("lib/proposal-public-server.ts");
for (const token of ["public_token_hash", "public_token_expires_at", "proposal_versions", "budget_lines"]) assert(publicProposal.includes(token), `Missing proposal token: ${token}`);

const webhook = read("lib/webhook-security.ts");
for (const token of ["verifyWebhookRequest", "timingSafeEqual", "timestamp_out_of_tolerance", "providerIdempotencyKey"]) assert(webhook.includes(token), `Missing webhook token: ${token}`);

const upload = read("app/api/documentos/upload-url/route.ts");
for (const token of ["requireInternalAccess", "validatePrivateUpload", "sanitizeFileName"]) assert(upload.includes(token), `Missing upload guard token: ${token}`);

const confirmUpload = read("app/api/documentos/confirm-upload/route.ts");
for (const token of ["confirmDocumentUploadRepository", "storagePath", "mimeType", "sizeBytes", "retentionDays"]) assert(confirmUpload.includes(token), `Missing confirm upload token: ${token}`);

const payment = read("app/api/payments/manual/route.ts");
for (const token of ["paymentPreflight", "proposal_not_accepted", "payment_reference_required"]) assert(payment.includes(token), `Missing payment token: ${token}`);

const health = read("app/api/health/route.ts");
assert(!health.includes("supabaseAdminConfigured"), "Public health must not expose internal config");

const internalHealth = read("app/api/health/internal/route.ts");
for (const token of ["requireInternalAccess", "supabaseAdminConfigured", "webhooksHmacConfigured"]) assert(internalHealth.includes(token), `Missing internal health token: ${token}`);

const migration5 = read("supabase/migrations/0005_routsify_settings_and_outbox_worker.sql");
for (const token of ["routsify_settings", "routsify_settings_audit_log", "locked_at", "processed_at", "mime_type", "size_bytes", "checksum"]) assert(migration5.includes(token), `Missing migration 0005 token: ${token}`);

console.log("MVP static validation passed.");
