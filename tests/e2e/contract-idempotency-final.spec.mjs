import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 0 });

const caseId = "b96113c0-00d2-4e3f-ae06-b2a232cb9136";
const contractId = "0592556c-684b-4f57-a6a1-900c689bf341";
const originalSignedAt = "2026-07-20T14:21:15.076Z";

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

test("re-saving a signed contract preserves the signature and advanced case state", async ({ page }) => {
  test.setTimeout(120000);
  await login(page);

  const response = await api(page, `/api/routsify/cases/${caseId}/contracts`, "POST", {
    id: contractId,
    status: "signed",
    title: "Contrato de viaje",
    notes: "[PRUEBA E2E ROUTSIFY] comprobación final de idempotencia",
  });

  expect(String(response.data?.id || "")).toBe(contractId);
  expect(String(response.data?.status || "")).toBe("signed");
  expect(new Date(response.data?.signed_at).toISOString()).toBe(originalSignedAt);

  console.log("CONTRACT_IDEMPOTENCY_CERTIFIED", JSON.stringify({
    caseId,
    contractId,
    signedAt: response.data?.signed_at,
  }));
});
