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
  "app/clientes/page.tsx",
  "app/expedientes/page.tsx",
  "app/propuestas/page.tsx",
  "app/compras/page.tsx",
  "app/viajeros/page.tsx",
  "app/contratos/page.tsx",
  "app/informes/page.tsx",
  "app/ajustes/page.tsx",
];

const redirectRoutes = {
  "app/tareas/page.tsx": "/hoy",
  "app/comunicaciones/page.tsx": "/expedientes",
  "app/documentos/page.tsx": "/viajeros",
  "app/proveedores/page.tsx": "/compras",
  "app/facturacion/page.tsx": "/contratos",
  "app/integraciones/page.tsx": "/ajustes",
  "app/cierre/page.tsx": "/expedientes",
  "app/seguridad/page.tsx": "/ajustes",
  "app/ajustes/tipos-servicio/page.tsx": "/ajustes",
};

function read(path) {
  return readFileSync(join(root, path), "utf8");
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function countCanonicalHrefRows(source) {
  return (source.match(/\{ href: "\//g) || []).length;
}

for (const file of requiredFiles) assert(existsSync(join(root, file)), `Missing required file: ${file}`);
for (const [path, target] of Object.entries(redirectRoutes)) {
  const file = read(path);
  assert(file.includes("redirect"), `Expected redirect in ${path}`);
  assert(file.includes(target), `Expected ${path} to redirect to ${target}`);
}

const appShell = read("components/AppShell.tsx");
for (const label of ["Inicio", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Viajeros y Documentos", "Contrato, Firma y Pago", "Informes", "Ajustes"]) assert(appShell.includes(label), `Missing nav label: ${label}`);
for (const removed of ["Dashboard", "Alertas", "Configuración", "demo-public-token"]) assert(!appShell.includes(removed), `Removed item still visible: ${removed}`);

const home = read("app/page.tsx");
assert(home.includes('redirect("/hoy")'), "Root must redirect to /hoy");

const navigation = read("lib/navigation.ts");
assert(countCanonicalHrefRows(navigation) === 9, "There must be exactly 9 canonical pages including Ajustes");
assert(!navigation.includes("Propuesta pública"), "Public proposal must not be an internal module");

const migration1 = read("supabase/migrations/0001_routsify_mvp_schema.sql");
for (const table of ["clients", "leads", "bookings", "cases", "proposals", "proposal_versions", "budget_lines", "expected_purchases", "supplier_invoices", "suppliers", "travelers", "documents", "contracts", "payments", "billing_documents", "integration_outbox", "audit_log"]) assert(migration1.includes(`public.${table}`), `Missing schema table: ${table}`);

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
assert(publicAcceptance.includes("verifyProposalToken"), "Proposal token is not verified");
assert(publicAcceptance.includes("accept_proposal_version"), "Acceptance RPC missing");

const health = read("app/api/health/route.ts");
assert(health.includes("demoMode"), "Health endpoint missing demoMode");
assert(health.includes("supabaseAdminConfigured"), "Health endpoint missing admin status");

const outboxServer = read("lib/outbox-server.ts");
assert(outboxServer.includes("upsert"), "Outbox must be idempotent");
assert(outboxServer.includes("idempotencyKey"), "Outbox idempotency key missing");

const storageServer = read("lib/storage-server.ts");
assert(storageServer.includes("case-documents"), "Private storage bucket missing");
assert(storageServer.includes("createSignedUploadUrl"), "Signed upload helper missing");

const envExample = read(".env.example");
for (const key of ["PROPOSAL_TOKEN_SECRET", "FORM_WEBHOOK_SECRET", "BOOKING_WEBHOOK_SECRET"]) assert(envExample.includes(key), `Missing env placeholder: ${key}`);
assert(!envExample.includes("sb_publishable_"), "Template contains a concrete publishable key");

console.log("MVP static validation passed.");
