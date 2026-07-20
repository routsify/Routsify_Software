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
    const response = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    return { status: response.status, json: await response.json().catch(() => null) };
  }, { path, method, body });
  if (!tolerate) {
    expect(result.status, JSON.stringify(result.json)).toBeLessThan(300);
    expect(result.json?.ok, JSON.stringify(result.json)).toBe(true);
  }
  return result;
}

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");

test("Booking create update cancel in production", async ({ page }) => {
  test.setTimeout(180000);
  await login(page);
  const found = await call(page, "/api/routsify/clients?paginated=1&page=1&pageSize=50&q=info%40routsify.com");
  const rows = found.json?.data?.items || found.json?.data || [];
  const client = rows.find((row) => String(row.email || "").toLowerCase() === "info@routsify.com");
  expect(client).toBeTruthy();
  const start = new Date(Date.now() + 21 * 86400000);
  start.setUTCHours(10, 0, 0, 0);
  let localId = "";
  let externalId = "";
  let status = "";
  try {
    const created = await call(page, "/api/routsify/clients/booking/reservations", "POST", { clientId: client.id, startsAt: start.toISOString(), durationMinutes: 30, timezone: "Europe/Madrid", notes: `[PRUEBA E2E ROUTSIFY ${process.env.GITHUB_RUN_ID}]`, privacyAccepted: true });
    localId = String(created.json?.data?.booking?.id || "");
    externalId = String(created.json?.data?.remote?.externalBookingId || "");
    expect(localId).not.toBe("");
    expect(externalId).not.toBe("");
    await call(page, `/api/routsify/clients/booking/reservations/${localId}`, "PATCH", { notes: "[PRUEBA E2E ROUTSIFY] actualización correcta" });
  } finally {
    if (localId) {
      const cancelled = await call(page, `/api/routsify/clients/booking/reservations/${localId}`, "DELETE", undefined, true);
      expect(cancelled.status, JSON.stringify(cancelled.json)).toBeLessThan(300);
      expect(cancelled.json?.ok, JSON.stringify(cancelled.json)).toBe(true);
      status = String(cancelled.json?.data?.booking?.status || cancelled.json?.data?.remote?.status || "").toLowerCase();
    }
  }
  expect(status).toContain("cancel");
  console.log("BOOKING_FINAL_E2E", JSON.stringify({ localId, externalId, status }));
});
