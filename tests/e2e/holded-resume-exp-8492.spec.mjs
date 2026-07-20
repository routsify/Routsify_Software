import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 0 });

const caseId = "b96113c0-00d2-4e3f-ae06-b2a232cb9136";
const proposalId = "a9bbdcd4-aa0a-40ed-9247-822b20103a0f";
const caseCode = "EXP-2026-8492";

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

function list(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function drain(page, label) {
  const result = await api(page, "/api/routsify/outbox/process", "POST", { limit: 50 });
  expect(Number(result.failed || 0), `${label}: ${JSON.stringify(result.details || [])}`).toBe(0);
  expect(Number(result.manualReview || 0), `${label}: ${JSON.stringify(result.details || [])}`).toBe(0);
  return result;
}

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");

test("resume purchase payment proforma and final invoice", async ({ page }) => {
  test.setTimeout(300000);
  await login(page);
  const marker = String(process.env.GITHUB_RUN_ID || Date.now());
  const tag = `[PRUEBA E2E ROUTSIFY RESUME ${marker}]`;

  const purchases = await api(page, "/api/routsify/expected-purchases");
  const purchase = list(purchases).find((row) => String(row.case_id) === caseId);
  expect(purchase, `No se generó compra para ${caseCode}`).toBeTruthy();
  const purchaseId = String(purchase.id);

  await api(page, "/api/routsify/expected-purchases/sync-holded", "POST", { purchaseId });
  await drain(page, "compra Holded");
  const syncedPurchase = await api(page, `/api/routsify/expected-purchases/${purchaseId}`);
  expect(String(syncedPurchase.data?.holded_purchase_id || "")).not.toBe("");
  await api(page, `/api/routsify/expected-purchases/${purchaseId}`, "PATCH", {
    status: "approved",
    approved_cost: 10,
    review_notes: `${tag} compra aprobada`,
  });

  const reference = `E2E-RESUME-${marker}`;
  await api(page, "/api/payments/manual", "POST", {
    caseId,
    amount: 15,
    reference,
    currency: "EUR",
    method: "manual_e2e",
    notes: `${tag} pago total`,
  });
  const fiscalBatch = await drain(page, "cobro y proforma Holded");
  expect(Number(fiscalBatch.processed || 0)).toBeGreaterThanOrEqual(2);

  await api(page, "/api/routsify/jobs/run", "POST", { job: "fiscal_final_invoice_check" });
  const invoiceBatch = await drain(page, "factura final Holded");
  expect(Number(invoiceBatch.processed || 0)).toBeGreaterThan(0);

  console.log("HOLDED_RESUME_CERTIFIED", JSON.stringify({ marker, caseId, caseCode, proposalId, purchaseId, reference }));
});
