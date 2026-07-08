import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "supabase/migrations/0001_routsify_mvp_schema.sql",
  "supabase/migrations/0002_routsify_mvp_rls_audit_storage.sql",
  "lib/supabase-admin.ts",
  "lib/proposal-token.ts",
  "app/api/propuestas/[token]/accept/route.ts",
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

const migration1 = read("supabase/migrations/0001_routsify_mvp_schema.sql");
for (const table of ["clients", "leads", "bookings", "cases", "proposals", "proposal_versions", "budget_lines", "expected_purchases", "supplier_invoices", "suppliers", "travelers", "documents", "contracts", "payments", "billing_documents", "integration_outbox", "audit_log"]) {
  assert(migration1.includes(`public.${table}`), `Missing schema table: ${table}`);
}

const migration2 = read("supabase/migrations/0002_routsify_mvp_rls_audit_storage.sql");
assert(migration2.includes("enable row level security"), "RLS not enabled");
assert(migration2.includes("audit_row_change"), "Audit trigger missing");
assert(migration2.includes("case-documents"), "Private document bucket missing");
assert(migration2.includes("accept_proposal_version"), "Proposal acceptance RPC missing");

const publicAcceptance = read("app/api/propuestas/[token]/accept/route.ts");
assert(publicAcceptance.includes("verifyProposalToken"), "Proposal token is not verified in API route");
assert(publicAcceptance.includes("accept_proposal_version"), "Acceptance route does not call RPC");

const envExample = read(".env.example");
assert(!envExample.includes("sb_publishable_"), "Template must not contain a concrete Supabase publishable key");
assert(envExample.includes("PROPOSAL_TOKEN_SECRET"), "Missing proposal token secret placeholder");

console.log("MVP static validation passed.");
