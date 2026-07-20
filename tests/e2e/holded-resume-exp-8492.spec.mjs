import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 0 });

const caseId = "b96113c0-00d2-4e3f-ae06-b2a232cb9136";
const clientId = "d4112107-3f9c-4ff6-a0df-db7a371121fc";
const proposalId = "a9bbdcd4-aa0a-40ed-9247-822b20103a0f";
const contractId = "0592556c-684b-4f57-a6a1-900c689bf341";
const caseCode = "EXP-2026-8492";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20000 });
}

async function request(page, path, method = "GET", body, tolerate = false) {
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
  if (!tolerate) {
    expect(result.status, `${path}: ${JSON.stringify(result.payload)}`).toBeLessThan(300);
    expect(result.payload?.ok, `${path}: ${JSON.stringify(result.payload)}`).toBe(true);
  }
  return result;
}

async function api(page, path, method = "GET", body) {
  const result = await request(page, path, method, body);
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

test("complete fiscal data, sign contract and certify Holded fiscal lifecycle", async ({ page }) => {
  test.setTimeout(300000);
  await login(page);
  const marker = String(process.env.GITHUB_RUN_ID || Date.now());
  const tag = `[PRUEBA E2E ROUTSIFY RESUME ${marker}]`;

  const existingClient = await api(page, `/api/routsify/clients/${clientId}`);
  const client = existingClient.data;
  const updatedClient = await api(page, `/api/routsify/clients/${clientId}`, "PATCH", {
    display_name: client.display_name,
    email: client.email,
    phone: client.phone || "+34600000000",
    client_type: client.client_type || "person",
    country: "ES",
    tax_id: "E2E12345678",
    billing_address: {
      address: "Calle Prueba Fiscal 1",
      city: "Madrid",
      postal_code: "28001",
      country_code: "ES",
    },
    notes: client.notes || `${tag} datos fiscales de certificación`,
  });
  expect(String(updatedClient.data?.tax_id || "")).toBe("E2E12345678");
  expect(String(updatedClient.data?.billing_address?.address || "")).not.toBe("");
  await drain(page, "actualización fiscal de cliente");

  const signed = await api(page, `/api/routsify/cases/${caseId}/contracts`, "POST", {
    id: contractId,
    status: "signed",
    title: `${tag} Contrato firmado`,
    notes: `${tag} firma de certificación`,
  });
  expect(String(signed.data?.id || "")).toBe(contractId);
  expect(String(signed.data?.status || "")).toBe("signed");

  const purchases = await api(page, "/api/routsify/expected-purchases");
  const purchase = list(purchases).find((row) => String(row.case_id) === caseId);
  expect(purchase, `No se generó compra para ${caseCode}`).toBeTruthy();
  const purchaseId = String(purchase.id);

  let syncedPurchase = await api(page, `/api/routsify/expected-purchases/${purchaseId}`);
  if (!String(syncedPurchase.data?.holded_purchase_id || "")) {
    await api(page, "/api/routsify/expected-purchases/sync-holded", "POST", { purchaseId });
    await drain(page, "compra Holded");
    syncedPurchase = await api(page, `/api/routsify/expected-purchases/${purchaseId}`);
  }
  expect(String(syncedPurchase.data?.holded_purchase_id || "")).not.toBe("");

  if (String(syncedPurchase.data?.status || "") !== "approved") {
    await api(page, `/api/routsify/expected-purchases/${purchaseId}`, "PATCH", {
      status: "approved",
      approved_cost: 10,
      review_notes: `${tag} compra aprobada`,
    });
  }

  const reference = `E2E-FINAL-${marker}`;
  const payment = await api(page, "/api/payments/manual", "POST", {
    caseId,
    amount: 15,
    reference,
    currency: "EUR",
    method: "manual_e2e",
    notes: `${tag} pago total`,
  });
  expect(payment.payment_confirmed).toBe(true);
  expect(String(payment.proforma?.document_id || "")).not.toBe("");
  expect(String(payment.payment_outbox_id || "")).not.toBe("");

  const fiscalBatch = await drain(page, "cobro y proforma Holded");
  expect(Number(fiscalBatch.processed || 0)).toBeGreaterThanOrEqual(2);

  await api(page, "/api/routsify/jobs/run", "POST", { job: "fiscal_final_invoice_check" });
  const invoiceBatch = await drain(page, "factura final Holded");
  expect(Number(invoiceBatch.processed || 0)).toBeGreaterThan(0);

  console.log("HOLDED_FINAL_CERTIFIED", JSON.stringify({ marker, caseId, clientId, caseCode, proposalId, contractId, purchaseId, reference, fiscalBatch, invoiceBatch }));
});
