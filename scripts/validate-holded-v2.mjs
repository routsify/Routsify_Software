import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const server = read("lib/holded-server.ts");
const handlers = read("lib/holded-outbox-handlers-v2.ts");
const env = read(".env.example");
const route = read("app/api/routsify/settings/integrations/[integration]/test/route.ts");

assert(server.includes('const HOLDED_API_ORIGIN = "https://api.holded.com"'), "Holded API origin must use the official v2 host");
assert(server.includes('Authorization: `Bearer ${apiKey}`'), "Holded authentication must use Authorization Bearer");
assert(!server.includes('key: apiKey'), "Legacy Holded key header must not be used");
assert(!server.includes('/invoicing/v1/'), "Legacy Holded v1 endpoints must not be used");
for (const path of ["/api/v2/contacts", "/api/v2/estimates", "/api/v2/proformas", "/api/v2/invoices", "/api/v2/purchases", "/api/v2/payments"]) {
  assert(server.includes(path), `Missing Holded v2 endpoint ${path}`);
}
for (const field of ["contact_id", "vat_number", "due_date", "price", "bill_address"]) {
  assert(server.includes(field), `Missing Holded v2 payload field ${field}`);
}
assert(handlers.includes("ensureSupplierContact"), "Supplier purchases must create or reuse a Holded supplier contact");
assert(handlers.includes('direction: "collection"'), "Client payments must be sent as Holded collections");
assert(route.includes("missingReadScopes"), "Holded test route must expose missing scopes");
assert(route.includes("faltan permisos de lectura"), "Holded test route must explain missing permissions in Spanish");
assert(env.includes("HOLDED_API_BASE_URL=https://api.holded.com"), "Environment example must use the v2 Holded origin");

console.log("Holded API v2 validation passed.");
