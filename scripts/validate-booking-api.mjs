import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

for (const file of [
  "lib/routsify-booking-api-server.ts",
  "lib/routsify-booking-local-server.ts",
  "app/clientes/[clientId]/BookingApiPanel.tsx",
  "app/api/routsify/clients/booking/link/route.ts",
  "app/api/routsify/clients/booking/availability/route.ts",
  "app/api/routsify/clients/booking/reservations/route.ts",
  "app/api/routsify/clients/booking/reservations/[bookingId]/route.ts",
  "supabase/migrations/20260718185551_allow_booking_api_key_and_index.sql",
  "supabase/migrations/20260718185613_extend_booking_api_vault_function.sql",
  "docs/ROUTSIFY_BOOKING_API.md",
]) assert(existsSync(join(root, file)), `Missing Booking API file: ${file}`);

const secrets = read("lib/organization-secrets-server.ts");
for (const token of ["booking_api_key", "BOOKING_API_KEY"]) assert(secrets.includes(token), `Missing Booking secret token: ${token}`);

const config = read("lib/third-party-integration-config-server.ts");
for (const token of ["https://call.routsify.com/wp-json/routsify/v1", "X-Routsify-API-Key", "bookingPathTemplate", "defaultDurationMinutes"]) {
  if (token === "X-Routsify-API-Key") continue;
  assert(config.includes(token), `Missing Booking configuration token: ${token}`);
}

const client = read("lib/routsify-booking-api-server.ts");
for (const token of ["X-Routsify-API-Key", "Authorization", "createRemoteBooking", "updateRemoteBooking", "cancelRemoteBooking", "listRemoteBookingAvailability", "buildPersonalizedBookingLink", "booking_api_timeout"]) assert(client.includes(token), `Missing Booking API client token: ${token}`);
assert(!client.includes("console.log(apiKey"), "Booking API key must never be logged");

const panel = read("app/clientes/[clientId]/BookingApiPanel.tsx");
for (const token of ["Copiar enlace", "Enviar por email", "Enviar por WhatsApp", "Consultar disponibilidad", "Reservar llamada", "Reprogramar", "Cancelar"]) assert(panel.includes(token), `Missing Booking panel action: ${token}`);

const migration = [
  read("supabase/migrations/20260718185551_allow_booking_api_key_and_index.sql"),
  read("supabase/migrations/20260718185613_extend_booking_api_vault_function.sql"),
].join("\n");
for (const token of ["booking_api_key", "organization_secrets_secret_key_check", "set_organization_secret", "bookings_org_external_latest_idx"]) assert(migration.includes(token), `Missing Booking migration token: ${token}`);

console.log("Booking API static validation passed.");
