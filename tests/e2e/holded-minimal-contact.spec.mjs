import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20000 });
}

async function call(page, path, method = "GET", body) {
  const result = await page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    return { status: response.status, json: await response.json().catch(() => null) };
  }, { path, method, body });
  expect(result.status, JSON.stringify(result.json)).toBeLessThan(300);
  expect(result.json?.ok, JSON.stringify(result.json)).toBe(true);
  return result.json;
}

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");

test("Holded accepts minimal contact payload", async ({ page }) => {
  test.setTimeout(120000);
  await login(page);
  const processed = await call(page, "/api/routsify/outbox/process", "POST", { limit: 10 });
  expect(Number(processed.failed || 0), JSON.stringify(processed.details || [])).toBe(0);
  expect(Number(processed.manualReview || 0), JSON.stringify(processed.details || [])).toBe(0);
  const found = await call(page, "/api/routsify/clients?paginated=1&page=1&pageSize=20&q=info%2Be2e-29735674513%40routsify.com");
  const rows = found.data?.items || found.data || [];
  const client = rows.find((row) => String(row.email || "") === "info+e2e-29735674513@routsify.com");
  expect(client).toBeTruthy();
  const detail = await call(page, `/api/routsify/clients/${client.id}`);
  expect(String(detail.data?.holded_contact_id || "")).not.toBe("");
  console.log("HOLDED_MINIMAL_CONTACT", JSON.stringify({ clientId: client.id, holdedContactId: detail.data.holded_contact_id }));
});
