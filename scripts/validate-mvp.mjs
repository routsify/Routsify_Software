import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

for (const file of [
  "middleware.ts",
  "app/page.tsx",
  "app/login/page.tsx",
  "app/login/LoginForm.tsx",
  "lib/api-security.ts",
  "lib/runtime-mode.ts",
  "lib/supabase-browser.ts",
  "lib/webhook-security.ts",
  "lib/proposal-public-server.ts",
  "lib/economics-server.ts",
  "lib/expected-purchases-server.ts",
  "lib/jobs-server.ts",
  "app/api/documentos/upload-url/route.ts",
  "app/api/documentos/confirm-upload/route.ts",
  "app/api/payments/manual/route.ts",
  "app/api/webhooks/payments/route.ts",
  "app/api/webhooks/holded/route.ts",
  "app/api/routsify/jobs/run/route.ts",
  "supabase/migrations/0006_routsify_settings_and_outbox_worker.sql",
  "supabase/migrations/0016_mvp_completion_and_acceptance.sql",
  "components/AppShell.tsx",
  "lib/navigation.ts",
]) assert(existsSync(join(root, file)), `Missing required file: ${file}`);

assert(read("app/page.tsx").includes('redirect("/login")'), "Root must redirect to login");
assert(!read("package.json").includes('"latest"'), "Dependencies must not use latest");

const browser = read("lib/supabase-browser.ts");
assert(browser.includes("createBrowserClient"), "Browser auth must use SSR browser client");
assert(browser.includes("NEXT_PUBLIC_SUPABASE_URL"), "Browser env url must be direct");
assert(browser.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), "Browser env key must be direct");

const runtime = read("lib/runtime-mode.ts");
assert(runtime.includes('NEXT_PUBLIC_DEMO_MODE === "true"'), "Demo must be explicit");
assert(runtime.includes('ROUTSIFY_ALLOW_PUBLIC_DEMO === "true"'), "Public demo must be explicit");
assert(!runtime.includes('ROUTSIFY_ALLOW_PUBLIC_DEMO !== "false"'), "Public demo must not be default");

const security = read("lib/api-security.ts");
for (const token of ["auth.getUser", '.eq("id", userId)', "allowedRoles", "INTERNAL_TOKEN_PATHS", "timingSafeEqual"]) assert(security.includes(token), `Missing API security token: ${token}`);

const login = read("app/login/LoginForm.tsx");
for (const token of ["signInWithPassword", "ensure_profile_for_current_user", "resetPasswordForEmail", "¿Has olvidado tu contraseña?", "showPassword", "safeNext"]) assert(login.includes(token), `Missing login token: ${token}`);
assert(!login.includes("disabled={!canUseAuth}"), "Login inputs must remain writable");
for (const forbidden of ["Supabase Auth", ">RLS<", "middleware de autenticación"]) assert(!login.includes(forbidden), `Public login must not expose implementation detail: ${forbidden}`);

const middleware = read("middleware.ts");
for (const token of ["/api/routsify", "/api/documentos/confirm-upload", "authentication_required", "isPublicDemoAllowed"]) assert(middleware.includes(token), `Missing middleware token: ${token}`);

const nav = read("lib/navigation.ts");
for (const label of ["Inicio", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Informes", "Ajustes"]) assert(nav.includes(label), `Missing module: ${label}`);
assert(!nav.includes("/viajeros"), "Travelers must not be a main module");
assert(!nav.includes("/contratos"), "Contracts must not be a main module");

const publicProposal = read("lib/proposal-public-server.ts");
for (const token of ["public_token_hash", "public_token_expires_at", "proposal_versions", "budget_lines"]) assert(publicProposal.includes(token), `Missing proposal token: ${token}`);

const webhook = read("lib/webhook-security.ts");
for (const token of ["verifyWebhookRequest", "timingSafeEqual", "timestamp_out_of_tolerance", "providerIdempotencyKey"]) assert(webhook.includes(token), `Missing webhook token: ${token}`);

const upload = read("app/api/documentos/upload-url/route.ts");
for (const token of ["requireInternalAccess", "validatePrivateUpload", "sanitizeFileName"]) assert(upload.includes(token), `Missing upload token: ${token}`);

const confirmUpload = read("app/api/documentos/confirm-upload/route.ts");
for (const token of ["confirmDocumentUploadRepository", "storagePath", "mimeType", "sizeBytes", "retentionDays", "supplier_invoice"]) assert(confirmUpload.includes(token), `Missing confirm-upload token: ${token}`);

const payment = read("app/api/payments/manual/route.ts");
for (const token of ["paymentPreflight", "proposal_not_accepted", "payment_reference_required", "confirm_external_payment"]) assert(payment.includes(token), `Missing payment token: ${token}`);

const completion = read("supabase/migrations/0016_mvp_completion_and_acceptance.sql");
for (const token of ["proposal_acceptances", "accept_proposal_version", "confirm_supplier_invoice_upload", "operational_close_preflight", "confirm_external_payment", "claim_integration_outbox", "possible_duplicate_client_id"]) assert(completion.includes(token), `Missing MVP completion token: ${token}`);

const worker = read("lib/outbox-worker-server.ts");
for (const token of ["possibleDuplicateClientId", "createDuplicateReviewTask", "holdedRequest", "claim_integration_outbox"]) assert(worker.includes(token), `Missing outbox worker token: ${token}`);

console.log("MVP static validation passed.");
