import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "supabase/migrations/0001_routsify_mvp_schema.sql",
  "supabase/migrations/0002_routsify_mvp_rls_audit_storage.sql",
  "supabase/migrations/0003_routsify_mvp_integration_hardening.sql",
  "lib/supabase-admin.ts",
  "lib/proposal-token.ts",
  "lib/outbox-server.ts",
  "lib/storage-server.ts",
  "lib/holded-server.ts",
  "app/api/health/route.ts",
  "app/api/propuestas/[token]/accept/route.ts",
  "app/api/webhooks/forms/route.ts",
  "app/api/webhooks/bookings/route.ts",
  "app/api/payments/manual/route.ts",
  "app/api/documentos/upload-url/route.ts",
  "app/hoy/page.tsx",
  "app/cierre/CloseManager.tsx",
  "app/informes/page.tsx",
];

const requiredRoutes = [
  "solicitudes", "clientes", "expedientes", "tareas", "comunicaciones", "documentos", "viajeros", "propuestas", "contratos", "proveedores", "compras", "facturacion", "integraciones", "cierre", "informes", "seguridad"
];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Missing required file: ${file}`);
}

for (const route of requiredRoutes) {
  assert(existsSync(join(root, "app", route, "page.tsx")), `Missing route page: /${route}`);
}

const appShell = read("components/AppShell.tsx");
assert(!appShell.includes('["/", "Dashboard"]'), "Redundant Dashboard navigation should not exist");
assert(!appShell.includes("demo-public-token"), "Public proposal token should not appear in internal navigation");

const home = read("app/page.tsx");
assert(home.includes('redirect("/hoy")'), "Root route must redirect to daily workbench");

const navigation = read("lib/navigation.ts");
assert(!navigation.includes("Propuesta pública"), "Public proposal view should not be listed as an internal module");

const migration1 = read("supabase/migrations/0001_routsify_mvp_schema.sql");
for (const table of ["clients", "leads", "bookings", "cases", "proposals", "proposal_versions", "budget_lines", "expected_purchases", "supplier_invoices", "suppliers", "travelers", "documents", "contracts", "payments", "billing_documents", "integration_outbox", "audit_log"]) {
  assert(migration1.includes(`public.${table}`), `Missing schema table: ${table}`);
}

const migration2 = read("supabase/migrations/0002_routsify_mvp_rls_audit_storage.sql");
assert(migration2.includes("enable row level security"), "RLS not enabled");
assert(migration2.includes("audit_row_change"), "Audit trigger missing");
assert(migration2.includes("case-documents"), "Private document bucket missing");
assert(migration2.includes("accept_proposal_version"), "Proposal acceptance RPC missing");

const migration3 = read("supabase/migrations/0003_routsify_mvp_integration_hardening.sql");
assert(migration3.includes("public.webhook_events"), "Webhook event table missing");
assert(migration3.includes("enqueue_integration_event"), "Outbox enqueue RPC missing");
assert(migration3.includes("confirm_manual_payment"), "Manual payment RPC missing");

const publicAcceptance = read("app/api/propuestas/[token]/accept/route.ts");
assert(publicAcceptance.includes("verifyProposalToken"), "Proposal token is not verified in API route");
assert(publicAcceptance.includes("accept_proposal_version"), "Acceptance route does not call RPC");

const health = read("app/api/health/route.ts");
assert(health.includes("demoMode"), "Health endpoint must expose demo mode");
assert(health.includes("supabaseAdminConfigured"), "Health endpoint must expose server configuration status");

const outboxServer = read("lib/outbox-server.ts");
assert(outboxServer.includes("upsert"), "Outbox helper must be idempotent");
assert(outboxServer.includes("idempotencyKey"), "Outbox helper must expose idempotency key");

const storageServer = read("lib/storage-server.ts");
assert(storageServer.includes("case-documents"), "Storage helper must target private case-documents bucket");
assert(storageServer.includes("createSignedUploadUrl"), "Upload helper must use signed upload URLs");

const envExample = read(".env.example");
assert(!envExample.includes("sb_publishable_"), "Template must not contain a concrete Supabase publishable key");
assert(envExample.includes("PROPOSAL_TOKEN_SECRET"), "Missing proposal token secret placeholder");
assert(envExample.includes("FORM_WEBHOOK_SECRET"), "Missing form webhook secret placeholder");
assert(envExample.includes("BOOKING_WEBHOOK_SECRET"), "Missing booking webhook secret placeholder");

console.log("MVP static validation passed.");
