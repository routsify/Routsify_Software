import { test, expect } from "@playwright/test";

const ready = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const certifiedClientId = "d4112107-3f9c-4ff6-a0df-db7a371121fc";

test.describe.configure({ retries: 0 });

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
  const value = await api(page, "/api/routsify/outbox/process", "POST", { limit: 50 });
  expect(Number(value.failed || 0), `${label}: ${JSON.stringify(value.details || [])}`).toBe(0);
  expect(Number(value.manualReview || 0), `${label}: ${JSON.stringify(value.details || [])}`).toBe(0);
  return value;
}

function day(delta) {
  return new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
}

test.skip(!ready, "E2E credentials required");

test("real Holded estimate purchase payment proforma invoice", async ({ page }) => {
  test.setTimeout(300000);
  await login(page);

  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = `[PRUEBA E2E ROUTSIFY ${marker}]`;
  const email = `info+e2e-${marker}@routsify.com`;

  const syncedClient = await api(page, `/api/routsify/clients/${certifiedClientId}`);
  expect(String(syncedClient.data.holded_contact_id || "")).not.toBe("");
  const clientId = certifiedClientId;

  const supplier = await api(page, "/api/routsify/suppliers", "POST", {
    name: `${tag} Proveedor Holded`,
    category: "E2E",
    email,
    phone: "+34600000001",
    tax_id: `E2EP${marker.replace(/\W/g, "").slice(-7)}`,
    country: "ES",
    billing_address: { address: "Calle Prueba 2", city: "Madrid", postal_code: "28002", country_code: "ES" },
    notes: `${tag} borrar tras verificar`,
  });
  const supplierId = String(supplier.data.id);

  const createdCase = await api(page, "/api/routsify/cases", "POST", {
    client_id: clientId,
    title: `${tag} Expediente Holded`,
    destination: "Lisboa",
    trip_start: day(-15),
    trip_end: day(-10),
    currency: "EUR",
    final_notes: `${tag} borrar tras verificar`,
  });
  const caseId = String(createdCase.data.id);
  const caseCode = String(createdCase.data.case_code);

  const proposal = await api(page, "/api/routsify/proposals", "POST", { case_id: caseId });
  const proposalId = String(proposal.data.id);
  const versions = Array.isArray(proposal.data.proposal_versions) ? proposal.data.proposal_versions : [];
  const version = [...versions].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0))[0];
  expect(version).toBeTruthy();
  const versionId = String(version.id);

  await api(page, `/api/routsify/proposals/${proposalId}/lines`, "POST", {
    proposal_version_id: versionId,
    service_type_code: "custom",
    description_public: `${tag} Servicio de viaje`,
    description_internal: `${tag} compra de prueba`,
    supplier_id: supplierId,
    destination_segment: "Lisboa",
    start_date: day(-15),
    end_date: day(-10),
    cost_budget: 10,
    sale_price: 15,
    creates_expected_purchase: true,
  });
  const sent = await api(page, `/api/routsify/proposals/${proposalId}/send`, "POST", { validity_days: 7 });
  expect(String(sent.data.url || "")).toContain("/propuestas/");
  await drain(page, "presupuesto");

  const publicPath = new URL(sent.data.url).pathname;
  await api(page, `${publicPath}/accept`, "POST", {
    acceptor_name: `${tag} Aceptación`,
    acceptor_email: email,
    terms_accepted: true,
  });
  await api(page, `/api/routsify/cases/${caseId}/contracts`, "POST", {
    status: "signed",
    title: `${tag} Contrato firmado`,
    notes: `${tag} firma de prueba`,
  });

  const purchases = await api(page, "/api/routsify/expected-purchases");
  const purchase = list(purchases).find((row) => String(row.case_id) === caseId);
  expect(purchase, `No purchase for ${caseCode}`).toBeTruthy();
  const purchaseId = String(purchase.id);
  await api(page, "/api/routsify/expected-purchases/sync-holded", "POST", { purchaseId });
  await drain(page, "compra");
  const syncedPurchase = await api(page, `/api/routsify/expected-purchases/${purchaseId}`);
  expect(String(syncedPurchase.data.holded_purchase_id || "")).not.toBe("");
  await api(page, `/api/routsify/expected-purchases/${purchaseId}`, "PATCH", {
    status: "approved",
    approved_cost: 10,
    review_notes: `${tag} aprobada`,
  });

  const reference = `E2E-${marker}`;
  await api(page, "/api/payments/manual", "POST", {
    caseId,
    amount: 15,
    reference,
    currency: "EUR",
    method: "manual_e2e",
    notes: `${tag} pago total`,
  });
  const fiscalBatch = await drain(page, "proforma y cobro");
  expect(Number(fiscalBatch.processed || 0)).toBeGreaterThanOrEqual(2);

  await api(page, "/api/routsify/jobs/run", "POST", { job: "fiscal_final_invoice_check" });
  const invoiceBatch = await drain(page, "factura final");
  expect(Number(invoiceBatch.processed || 0)).toBeGreaterThan(0);

  console.log("HOLDED_E2E", JSON.stringify({ marker, clientId, supplierId, caseId, caseCode, proposalId, versionId, purchaseId, reference }));
});
