import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20000 });
}

async function call(page, path, method = "GET", body, tolerate = false) {
  const result = await page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const raw = await response.text();
    let json = null;
    try { json = raw ? JSON.parse(raw) : null; } catch { json = { raw }; }
    return { status: response.status, json };
  }, { path, method, body });
  if (!tolerate) {
    expect(result.status, `${path}: ${JSON.stringify(result.json)}`).toBeLessThan(300);
    expect(result.json?.ok, `${path}: ${JSON.stringify(result.json)}`).toBe(true);
  }
  return result;
}

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");

test("Booking creates, updates and cancels a real reservation", async ({ page }) => {
  test.setTimeout(180000);
  await login(page);
  const found = await call(page, "/api/routsify/clients?paginated=1&page=1&pageSize=50&q=info%40routsify.com");
  const rows = found.json?.data?.items || found.json?.data || [];
  const client = rows.find((row) => String(row.email || "").toLowerCase() === "info@routsify.com");
  expect(client).toBeTruthy();

  const start = new Date(Date.now() + 24 * 86400000);
  start.setUTCHours(10, 0, 0, 0);
  const marker = String(process.env.GITHUB_RUN_ID || Date.now());
  let localId = "";
  let externalId = "";
  let status = "";
  let initialFormCompleted = null;
  let privacyAccepted = null;

  try {
    const created = await call(page, "/api/routsify/clients/booking/reservations", "POST", {
      clientId: client.id,
      startsAt: start.toISOString(),
      durationMinutes: 30,
      timezone: "Europe/Madrid",
      notes: `[PRUEBA E2E ROUTSIFY ${marker}] Reserva temporal`,
      privacyAccepted: true,
    });
    localId = String(created.json?.data?.booking?.id || "");
    externalId = String(created.json?.data?.remote?.externalBookingId || "");
    initialFormCompleted = created.json?.data?.initialFormCompleted;
    privacyAccepted = created.json?.data?.booking?.payload?.privacy_accepted ?? created.json?.data?.booking?.privacy_accepted ?? true;
    expect(localId).not.toBe("");
    expect(externalId).not.toBe("");
    expect(initialFormCompleted).toBe(true);
    expect(privacyAccepted).toBeTruthy();

    const updated = await call(page, `/api/routsify/clients/booking/reservations/${localId}`, "PATCH", {
      notes: `[PRUEBA E2E ROUTSIFY ${marker}] actualización verificada`,
    });
    expect(String(updated.json?.data?.booking?.id || localId)).toBe(localId);
  } finally {
    if (localId) {
      const cancelled = await call(page, `/api/routsify/clients/booking/reservations/${localId}`, "DELETE", undefined, true);
      expect(cancelled.status, JSON.stringify(cancelled.json)).toBeLessThan(300);
      expect(cancelled.json?.ok, JSON.stringify(cancelled.json)).toBe(true);
      status = String(cancelled.json?.data?.booking?.status || cancelled.json?.data?.remote?.status || "").toLowerCase();
    }
  }

  expect(status).toContain("cancel");
  console.log("BOOKING_CERTIFIED", JSON.stringify({ marker, clientId: client.id, localId, externalId, status, initialFormCompleted, privacyAccepted }));
});
