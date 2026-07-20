import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 0 });

const clientId = "d4112107-3f9c-4ff6-a0df-db7a371121fc";
const expectedHoldedId = "6a5e00bd2a9493fc070f81cf";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20000 });
}

async function api(page, path, method = "GET", body) {
  const result = await page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { raw }; }
    return { status: response.status, payload };
  }, { path, method, body });
  expect(result.status, `${path}: ${JSON.stringify(result.payload)}`).toBeLessThan(300);
  expect(result.payload?.ok, `${path}: ${JSON.stringify(result.payload)}`).toBe(true);
  return result.payload;
}

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");

test("updates an existing Holded contact without changing its remote id", async ({ page }) => {
  test.setTimeout(180000);
  await login(page);

  const before = await api(page, `/api/routsify/clients/${clientId}`);
  const client = before.data;
  expect(String(client.holded_contact_id || "")).toBe(expectedHoldedId);
  const previousSync = String(client.holded_last_synced_at || "");
  const marker = String(process.env.GITHUB_RUN_ID || Date.now());

  const updated = await api(page, `/api/routsify/clients/${clientId}`, "PATCH", {
    display_name: client.display_name,
    email: client.email,
    phone: client.phone || "+34600000000",
    client_type: client.client_type || "person",
    country: client.country || "ES",
    tax_id: client.tax_id || "E2E12345678",
    billing_address: client.billing_address || {
      address: "Calle Prueba Fiscal 1",
      city: "Madrid",
      postal_code: "28001",
      country_code: "ES",
    },
    notes: `[PRUEBA E2E ROUTSIFY ${marker}] actualización real de contacto existente en Holded`,
  });
  expect(String(updated.data?.holded_contact_id || "")).toBe(expectedHoldedId);

  const drained = await api(page, "/api/routsify/outbox/process", "POST", { limit: 50 });
  expect(Number(drained.failed || 0), JSON.stringify(drained.details || [])).toBe(0);
  expect(Number(drained.manualReview || 0), JSON.stringify(drained.details || [])).toBe(0);
  expect(Number(drained.processed || 0)).toBeGreaterThan(0);

  const after = await api(page, `/api/routsify/clients/${clientId}`);
  expect(String(after.data?.holded_contact_id || "")).toBe(expectedHoldedId);
  expect(String(after.data?.holded_sync_status || "")).toBe("synced");
  expect(after.data?.holded_sync_error ?? null).toBeNull();
  expect(String(after.data?.holded_last_synced_at || "")).not.toBe("");
  if (previousSync) expect(new Date(after.data.holded_last_synced_at).getTime()).toBeGreaterThan(new Date(previousSync).getTime());

  console.log("HOLDED_EXISTING_CONTACT_UPDATE_CERTIFIED", JSON.stringify({
    marker,
    clientId,
    holdedContactId: after.data.holded_contact_id,
    previousSync,
    currentSync: after.data.holded_last_synced_at,
    processed: drained.processed,
  }));
});
