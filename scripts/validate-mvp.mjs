import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "middleware.ts",
  "next.config.mjs",
  "supabase/migrations/0001_routsify_mvp_schema.sql",
  "supabase/migrations/0002_routsify_mvp_rls_audit_storage.sql",
  "supabase/migrations/0003_routsify_mvp_integration_hardening.sql",
  "supabase/migrations/0004_routsify_mvp_security_model_hardening.sql",
  "lib/runtime-mode.ts",
  "lib/api-security.ts",
  "lib/webhook-security.ts",
  "lib/proposal-public-server.ts",
  "lib/supabase-admin.ts",
  "lib/proposal-token.ts",
  "lib/outbox-server.ts",
  "lib/storage-server.ts",
  "lib/holded-server.ts",
  "lib/client-master.ts",
  "lib/purchase-master.ts",
  "lib/settings-master.ts",
  "lib/demo-expedition-engine.ts",
  "lib/demo-holded-matching.ts",
  "lib/demo-ocr.ts",
  "app/ajustes/SettingsManager.tsx",
  "app/api/health/route.ts",
  "app/api/routsify/settings/route.ts",
  "app/api/routsify/settings/[module]/route.ts",
  "app/api/routsify/settings/[module]/reset/route.ts",
  "app/api/routsify/settings/export/route.ts",
  "app/api/routsify/settings/import/route.ts",
  "app/api/routsify/settings/audit/route.ts",
  "app/api/routsify/settings/integrations/[integration]/test/route.ts",
  "app/api/routsify/system/actions/route.ts",
  "app/api/routsify/expected-purchases/route.ts",
  "app/api/routsify/expected-purchases/sync-holded/route.ts",
  "app/api/routsify/expected-purchases/[purchaseId]/route.ts",
  "app/api/routsify/expected-purchases/[purchaseId]/find-candidates/route.ts",
  "app/api/routsify/expected-purchases/[purchaseId]/approve-match/route.ts",
  "app/api/routsify/expected-purchases/[purchaseId]/manual-review/route.ts",
  "app/api/routsify/expected-purchases/[purchaseId]/not-required/route.ts",
  "app/api/routsify/expected-purchases/[purchaseId]/request-invoice/route.ts",
  "app/api/propuestas/[token]/accept/route.ts",
  "app/api/webhooks/forms/route.ts",
  "app/api/webhooks/bookings/route.ts",
  "app/api/payments/manual/route.ts",
  "app/api/documentos/upload-url/route.ts",
  "app/hoy/page.tsx",
  "app/clientes/page.tsx",
  "app/clientes/ClientsManager.tsx",
  "app/expedientes/page.tsx",
  "app/expedientes/[caseCode]/page.tsx",
  "app/propuestas/[token]/page.tsx",
  "app/propuestas/page.tsx",
  "app/compras/page.tsx",
  "app/compras/PurchasesManager.tsx",
  "app/viajeros/page.tsx",
  "app/contratos/page.tsx",
  "app/informes/page.tsx",
  "app/ajustes/page.tsx",
];

const redirectRoutes = {
  "app/tareas/page.tsx": "/hoy",
  "app/comunicaciones/page.tsx": "/expedientes",
  "app/documentos/page.tsx": "/expedientes",
  "app/viajeros/page.tsx": "/expedientes",
  "app/contratos/page.tsx": "/expedientes",
  "app/proveedores/page.tsx": "/compras",
  "app/facturacion/page.tsx": "/expedientes",
  "app/integraciones/page.tsx": "/ajustes",
  "app/cierre/page.tsx": "/expedientes",
  "app/seguridad/page.tsx": "/ajustes",
  "app/ajustes/tipos-servicio/page.tsx": "/ajustes",
};

function read(path) { return readFileSync(join(root, path), "utf8"); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function countCanonicalHrefRows(source) { return (source.match(/\{ href: "\//g) || []).length; }

for (const file of requiredFiles) assert(existsSync(join(root, file)), `Missing required file: ${file}`);
for (const [path, target] of Object.entries(redirectRoutes)) {
  const file = read(path);
  assert(file.includes("redirect"), `Expected redirect in ${path}`);
  assert(file.includes(target), `Expected ${path} to redirect to ${target}`);
}

const packageJson = read("package.json");
assert(!packageJson.includes('"latest"'), "package.json must not use latest dependencies");

const nextConfig = read("next.config.mjs");
for (const token of ["Content-Security-Policy", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) assert(nextConfig.includes(token), `Missing security header: ${token}`);

const middleware = read("middleware.ts");
for (const token of ["/api/routsify", "authentication_required", "ROUTSIFY_INTERNAL_API_TOKEN", "isPublicDemoAllowed"]) assert(middleware.includes(token), `Missing middleware token: ${token}`);

const appShell = read("components/AppShell.tsx");
for (const label of ["Inicio", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Informes", "Ajustes"]) assert(appShell.includes(label), `Missing nav label: ${label}`);
for (const removed of ["Dashboard", "Alertas", "Configuración", "demo-public-token", "Viajeros y Documentos", "Contrato, Firma y Pago"]) assert(!appShell.includes(removed), `Removed item still visible: ${removed}`);

const home = read("app/page.tsx");
assert(home.includes('redirect("/hoy")'), "Root must redirect to /hoy");

const navigation = read("lib/navigation.ts");
assert(countCanonicalHrefRows(navigation) === 7, "There must be exactly 7 canonical pages including Ajustes");
assert(!navigation.includes("/viajeros"), "Travelers must not be a canonical module");
assert(!navigation.includes("/contratos"), "Contracts must not be a canonical module");
assert(!navigation.includes("Propuesta pública"), "Public proposal must not be an internal module");

const caseDetail = read("app/expedientes/[caseCode]/page.tsx");
for (const token of ["#viajeros-documentos", "#contrato-pago", "Sin módulos separados", "Viajeros y documentos", "Contrato y pago", "Cobros y documentos fiscales"]) assert(caseDetail.includes(token), `Missing embedded case token: ${token}`);
assert(!caseDetail.includes('href="/viajeros"'), "Case detail should not link to removed travelers module");
assert(!caseDetail.includes('href="/contratos"'), "Case detail should not link to removed contracts module");

const publicProposal = read("app/propuestas/[token]/page.tsx");
for (const token of ["resolvePublicProposal", "notFound", "Acceso validado"]) assert(publicProposal.includes(token), `Missing public proposal token: ${token}`);

const webhookSecurity = read("lib/webhook-security.ts");
for (const token of ["verifyWebhookRequest", "canonicalJsonStringify", "timingSafeEqual", "timestamp_out_of_tolerance", "providerIdempotencyKey"]) assert(webhookSecurity.includes(token), `Missing webhook security token: ${token}`);

const formWebhook = read("app/api/webhooks/forms/route.ts");
const bookingWebhook = read("app/api/webhooks/bookings/route.ts");
for (const source of [formWebhook, bookingWebhook]) for (const token of ["request.text()", "verifyWebhookRequest", "providerIdempotencyKey", "x-routsify-timestamp", "x-routsify-signature"]) assert(source.includes(token), `Missing webhook route token: ${token}`);

const uploadRoute = read("app/api/documentos/upload-url/route.ts");
for (const token of ["requireInternalAccess", "validatePrivateUpload", "sanitizeFileName", "actorId"]) assert(uploadRoute.includes(token), `Missing upload guard token: ${token}`);
assert(!uploadRoute.includes("organizationId?:"), "Upload route must not accept organizationId from client body");

const paymentRoute = read("app/api/payments/manual/route.ts");
for (const token of ["paymentPreflight", "proposal_not_accepted", "payment_reference_required", "payment:manual:"]) assert(paymentRoute.includes(token), `Missing payment preflight token: ${token}`);

const clientMaster = read("lib/client-master.ts");
for (const token of ["demoClientMasters", "clientKpis", "possibleDuplicate", "clientFiscalMissing", "simulateHoldedSync", "createDemoClient", "filterClientMasters", "holded_contact_id", "accepted_value", "payments_received"]) assert(clientMaster.includes(token), `Missing client master token: ${token}`);

const clientsManager = read("app/clientes/ClientsManager.tsx");
for (const token of ["Clientes activos", "Pendientes de sync", "Valor aceptado", "Duplicados por revisar", "Estado Holded", "Datos fiscales", "Historial resumido", "Acciones rápidas", "Sincronizar Holded", "Revisar duplicados", "Nuevo presupuesto"]) assert(clientsManager.includes(token), `Missing clients UI token: ${token}`);

const purchaseMaster = read("lib/purchase-master.ts");
for (const token of ["ExpectedPurchaseStatus", "demoExpectedPurchases", "purchaseKpis", "filterPurchases", "holdedCandidate", "purchaseFlow", "purchaseAlerts", "approvePurchaseMatch", "markPurchaseNotRequired", "getPurchaseDetail", "blocksCaseClosing"]) assert(purchaseMaster.includes(token), `Missing purchase master token: ${token}`);

const purchasesManager = read("app/compras/PurchasesManager.tsx");
for (const token of ["Compras esperadas", "Pendientes de conciliar", "Con incidencias", "Valor pendiente", "Sincronizar Holded", "Sugerencia de matching", "Estado del flujo", "Aprobar match", "Revisar manualmente", "Marcar not_required", "bloquea el cierre"]) assert(purchasesManager.includes(token), `Missing purchases UI token: ${token}`);

const purchasesApi = read("app/api/routsify/expected-purchases/route.ts");
for (const token of ["pagination", "kpis", "filterPurchases", "purchaseKpis"]) assert(purchasesApi.includes(token), `Missing purchases API token: ${token}`);

const settingsMaster = read("lib/settings-master.ts");
for (const token of ["visibleNavigationModules", "SettingScope", "SettingValueType", "AppSetting", "settingsModules", "demoSettings", "demoSettingsAuditLog", "quickActions", "updateSettingsDemo", "resetModuleDemo", "exportDemoSettings", "importSettingsPreview", "testIntegration", "runSystemAction", "theme.updated", "margin_rules.updated", "fiscal_mode.updated", "report_config.updated", "roles.updated", "security_policy.updated", "manual_review", "proforma_on_payment", "invoice_on_advance", "final_invoice_after_trip"]) assert(settingsMaster.includes(token), `Missing settings token: ${token}`);
assert(!settingsMaster.includes('"Viajeros y Documentos"'), "Removed module should not be in visible settings navigation");
assert(!settingsMaster.includes('"Contrato, Firma y Pago"'), "Removed module should not be in visible settings navigation");

const settingsManager = read("app/ajustes/SettingsManager.tsx");
for (const token of ["Resumen de configuración", "Guardar todos los cambios", "Guardar cambios", "Restaurar módulo", "Acciones rápidas", "Información del sistema", "Auditoría reciente", "Retención", "Confianza OCR"]) assert(settingsManager.includes(token), `Missing setting token: ${token}`);

const settingsApi = read("app/api/routsify/settings/route.ts");
for (const token of ["demoSettings", "settingsSummary", "updateSettingsDemo"]) assert(settingsApi.includes(token), `Missing settings API token: ${token}`);

const demoEngine = read("lib/demo-expedition-engine.ts");
for (const token of ["getDemoExpeditionState", "buildDemoExpectedPurchasesFromBudget", "blockers", "timeline", "stageOrder"]) assert(demoEngine.includes(token), `Missing demo engine token: ${token}`);

const holdedMatching = read("lib/demo-holded-matching.ts");
for (const token of ["EXP_CODE", "confidence", "matchAction", "bestHoldedCandidate"]) assert(holdedMatching.includes(token), `Missing matching token: ${token}`);

const ocrDemo = read("lib/demo-ocr.ts");
for (const token of ["confidence", "revision_requerida", "aprobado", "reviewed_at"]) assert(ocrDemo.includes(token), `Missing OCR token: ${token}`);

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

const migration4 = read("supabase/migrations/0004_routsify_mvp_security_model_hardening.sql");
for (const token of ["stable_line_id", "supplier_id", "cost_real", "proposal_version_id", "retention_until", "document_access_log", "ensure_profile_for_current_user", "margin_rules", "fiscal_modes", "integration_runs", "tasks", "timeline_events", "travel-documents", "invoices", "proposal-assets"]) assert(migration4.includes(token), `Missing migration hardening token: ${token}`);

const publicAcceptance = read("app/api/propuestas/[token]/accept/route.ts");
assert(publicAcceptance.includes("verifyProposalToken"), "Proposal token is not verified");
assert(publicAcceptance.includes("accept_proposal_version"), "Acceptance RPC missing");
assert(publicAcceptance.includes("resolvePublicProposal"), "Acceptance fallback must be token-scoped");

const health = read("app/api/health/route.ts");
assert(health.includes("demoMode"), "Health endpoint missing demoMode");
assert(health.includes("supabaseAdminConfigured"), "Health endpoint missing admin status");

const outboxServer = read("lib/outbox-server.ts");
assert(outboxServer.includes("upsert"), "Outbox must be idempotent");
assert(outboxServer.includes("idempotencyKey"), "Outbox idempotency key missing");
assert(outboxServer.includes("canonicalJsonStringify"), "Outbox must use canonical idempotency hashing");

const storageServer = read("lib/storage-server.ts");
assert(storageServer.includes("case-documents"), "Private storage bucket missing");
assert(storageServer.includes("createSignedUploadUrl"), "Signed upload helper missing");
assert(storageServer.includes("document_access_log"), "Document access audit missing");

const envExample = read(".env.example");
for (const key of ["PROPOSAL_TOKEN_SECRET", "FORM_WEBHOOK_SECRET", "BOOKING_WEBHOOK_SECRET"]) assert(envExample.includes(key), `Missing env placeholder: ${key}`);
assert(!envExample.includes("sb_publishable_"), "Template contains a concrete publishable key");

console.log("MVP static validation passed.");
