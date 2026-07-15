import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

for (const file of [
  "proxy.ts",
  "app/page.tsx",
  "app/login/page.tsx",
  "app/login/LoginForm.tsx",
  "lib/api-security.ts",
  "lib/rbac.ts",
  "lib/effective-settings-server.ts",
  "lib/runtime-mode.ts",
  "lib/supabase-browser.ts",
  "lib/webhook-security.ts",
  "lib/proposal-public-server.ts",
  "lib/economics-server.ts",
  "lib/expected-purchases-server.ts",
  "lib/jobs-server.ts",
  "lib/organization-secrets-server.ts",
  "lib/openai-ocr-server.ts",
  "lib/payment-workflow-server.ts",
  "lib/fiscal-workflow-server.ts",
  "lib/outbox-worker-v11-server.ts",
  "app/clientes/ClientOperationsOverview.tsx",
  "app/propuestas/BudgetManager.tsx",
  "app/compras/PurchasesManagerOperational.tsx",
  "app/expedientes/[caseCode]/ContractPaymentsTab.tsx",
  "app/expedientes/[caseCode]/ActivityTab.tsx",
  "app/api/documentos/upload-url/route.ts",
  "app/api/documentos/confirm-upload/route.ts",
  "app/api/payments/manual/route.ts",
  "app/api/webhooks/payments/route.ts",
  "app/api/webhooks/holded/route.ts",
  "app/api/routsify/jobs/run/route.ts",
  "app/api/routsify/settings/secrets/[secretKey]/route.ts",
  "app/api/routsify/proposals/[proposalId]/payment-link/route.ts",
  "app/api/routsify/proposals/[proposalId]/lines/bulk/route.ts",
  "app/api/routsify/proposals/[proposalId]/send/route.ts",
  "app/api/routsify/cases/[caseId]/contracts/route.ts",
  "app/api/routsify/tasks/[taskId]/route.ts",
  "app/api/routsify/clients/documents/[documentId]/ocr/route.ts",
  "supabase/migrations/0018_integrations_fiscal_ocr_privacy.sql",
  "supabase/migrations/0019_settings_driven_business_policies.sql",
  "supabase/migrations/0005_routsify_settings_and_outbox_worker.sql",
  "supabase/migrations/0015_accept_proposal_version_rpc.sql",
  "components/AppShell.tsx",
  "lib/navigation.ts",
]) assert(existsSync(join(root, file)), `Missing required file: ${file}`);

assert(read("app/page.tsx").includes('redirect("/login")'), "Root must redirect to login");
assert(!read("package.json").includes('"latest"'), "Dependencies must not use latest");

const browser = read("lib/supabase-browser.ts");
for (const token of ["createBrowserClient", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) assert(browser.includes(token), `Missing browser auth token: ${token}`);

const runtime = read("lib/runtime-mode.ts");
assert(runtime.includes('NEXT_PUBLIC_DEMO_MODE === "true"'), "Demo must be explicit");
assert(runtime.includes('ROUTSIFY_ALLOW_PUBLIC_DEMO === "true"'), "Public demo must be explicit");
assert(!runtime.includes('ROUTSIFY_ALLOW_PUBLIC_DEMO !== "false"'), "Public demo must not be default");

const security = read("lib/api-security.ts");
for (const token of ["auth.getUser", "requiredPermission", "hasPermission", "timingSafeEqual"]) assert(security.includes(token), `Missing API security token: ${token}`);

const rbac = read("lib/rbac.ts");
for (const token of ["rolePermissions", "hasPermission", "settings.secrets.manage", "reports.view", "appNavigation"]) assert(rbac.includes(token), `Missing RBAC token: ${token}`);

const effectiveSettings = read("lib/effective-settings-server.ts");
for (const token of ["defaultSettings", "loadEffectiveSettings", "routsify_settings", "stringArray"]) assert(effectiveSettings.includes(token), `Missing effective settings token: ${token}`);

const businessPolicies = read("supabase/migrations/0019_settings_driven_business_policies.sql");
for (const token of ["routsify_setting_boolean", "purchases.auto_create", "cases.close.requires_purchases", "generate_expected_purchases_after_acceptance", "accept_proposal_version", "operational_close_preflight", "protect_case_closure"]) assert(businessPolicies.includes(token), `Missing settings-driven business policy token: ${token}`);

const login = read("app/login/LoginForm.tsx");
for (const token of ["signInWithPassword", "resetPasswordForEmail", "¿Has olvidado tu contraseña?", "showPassword", "safeNext"]) assert(login.includes(token), `Missing login token: ${token}`);
assert(!login.includes("disabled={!canUseAuth}"), "Login inputs must remain writable");
for (const forbidden of ["Supabase Auth", ">RLS<", "middleware de autenticación", "ensure_profile_for_current_user"]) assert(!login.includes(forbidden), `Public login must not expose implementation detail: ${forbidden}`);

const middleware = read("proxy.ts");
for (const token of ["/api/routsify", "/api/documentos/confirm-upload", "authentication_required", "isPublicDemoAllowed"]) assert(middleware.includes(token), `Missing proxy token: ${token}`);

const nav = read("lib/navigation.ts");
for (const label of ["Inicio", "Clientes", "Expedientes", "Presupuestos", "Compras / Proveedores", "Informes", "Ajustes"]) assert(nav.includes(label), `Missing module: ${label}`);
assert(!nav.includes("/viajeros"), "Travelers must not be a main module");
assert(!nav.includes("/contratos"), "Contracts must not be a main module");

const publicProposal = read("lib/proposal-public-server.ts");
for (const token of ["public_token_hash", "public_token_expires_at", "proposal_versions", "budget_lines"]) assert(publicProposal.includes(token), `Missing proposal token: ${token}`);

const proposalSend = read("app/api/routsify/proposals/[proposalId]/send/route.ts");
for (const token of ["loadEffectiveSettings", "budgets.validity_days", "validity_days", "configuredValidityDays"]) assert(proposalSend.includes(token), `Missing proposal validity setting token: ${token}`);

const webhook = read("lib/webhook-security.ts");
for (const token of ["verifyWebhookRequest", "timingSafeEqual", "timestamp_out_of_tolerance", "providerIdempotencyKey"]) assert(webhook.includes(token), `Missing webhook token: ${token}`);

const upload = read("app/api/documentos/upload-url/route.ts");
for (const token of ["requireInternalAccess", "validatePrivateUpload", "sanitizeFileName"]) assert(upload.includes(token), `Missing upload token: ${token}`);

const confirmUpload = read("app/api/documentos/confirm-upload/route.ts");
for (const token of ["confirmDocumentUploadRepository", "storagePath", "mimeType", "sizeBytes", "retentionDays", "supplier_invoice"]) assert(confirmUpload.includes(token), `Missing confirm-upload token: ${token}`);

const payment = read("app/api/payments/manual/route.ts");
for (const token of ["paymentPreflight", "proposal_not_accepted", "signed_contract_required", "payment_reference_required", "confirm_external_payment"]) assert(payment.includes(token), `Missing payment token: ${token}`);

const contract = read("app/api/routsify/cases/[caseId]/contracts/route.ts");
for (const token of ["accepted_proposal_required", "contract_signed", "Confirmar pago", "contracts.block_missing_fiscal", "clients.fiscal.required", "client_fiscal_data_required"]) assert(contract.includes(token), `Missing contract workflow token: ${token}`);

const budget = read("app/propuestas/BudgetManager.tsx");
for (const token of ["Importar tabla", "service_type_code", "description_public", "margin_applied", "creates_expected_purchase", "Descargar plantilla"]) assert(budget.includes(token), `Missing budget editor token: ${token}`);

const bulkLines = read("app/api/routsify/proposals/[proposalId]/lines/bulk/route.ts");
for (const token of ["rows_must_be_between_1_and_200", "resolveMarginRule", "proposal_version_locked", "creates_expected_purchase"]) assert(bulkLines.includes(token), `Missing bulk budget token: ${token}`);

const inbound = read("lib/outbox-worker-v11-server.ts");
for (const token of ["call_booked_form_pending", "fillout_reminder", "Revisar formulario recibido", "no se ha creado expediente"]) assert(inbound.includes(token), `Missing pre-case CRM token: ${token}`);
assert(!inbound.includes("createCaseRepository"), "Inbound Fillout or Booking must not create cases automatically");

const caseRoute = read("app/api/routsify/cases/[caseId]/route.ts");
for (const token of ["proposal_must_be_accepted", "signed_contract_required", "confirmed_payment_required", "operational_close_preflight"]) assert(caseRoute.includes(token), `Missing case relationship guard: ${token}`);

const outbox = read("lib/outbox-server.ts");
for (const token of ["holded_pending_configuration", "getOrganizationSecret", "pending_configuration"]) assert(outbox.includes(token), `Missing optional Holded token: ${token}`);

const acceptance = read("supabase/migrations/0015_accept_proposal_version_rpc.sql");
for (const token of ["accept_proposal_version", "proposal_versions", "locked", "proposal_accepted"]) assert(acceptance.includes(token), `Missing acceptance token: ${token}`);

const worker = read("lib/outbox-worker-server.ts");
for (const token of ["holdedRequest", "integration_outbox"]) assert(worker.includes(token), `Missing outbox worker token: ${token}`);

console.log("MVP static validation passed.");
