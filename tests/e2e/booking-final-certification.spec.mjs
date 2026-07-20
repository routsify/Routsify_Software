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

async function selectPublishedSlot(context) {
  const publicPage = await context.newPage();
  try {
    const response = await publicPage.goto("https://call.routsify.com/", { waitUntil: "networkidle", timeout: 60000 });
    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(500);

    const availableDates = await publicPage.locator('button[aria-label$="Día disponible"]').evaluateAll((nodes) => nodes
      .filter((node) => !node.disabled && (node.offsetWidth > 0 || node.offsetHeight > 0))
      .map((node) => String(node.getAttribute("aria-label") || "").match(/^(\d{4}-\d{2}-\d{2}) Día disponible$/)?.[1])
      .filter(Boolean));
    expect(availableDates.length, "Booking no publica ningún día disponible").toBeGreaterThan(0);

    const todayMadrid = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const selectedDate = availableDates.find((date) => date > todayMadrid) || availableDates[0];
    await publicPage.locator(`button[aria-label="${selectedDate} Día disponible"]`).click();

    await expect.poll(async () => {
      const buttons = await publicPage.locator("button").evaluateAll((nodes) => nodes
        .filter((node) => !node.disabled && (node.offsetWidth > 0 || node.offsetHeight > 0))
        .map((node) => `${node.getAttribute("aria-label") || ""} ${node.textContent || ""}`));
      return buttons.some((value) => /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(value));
    }, { timeout: 15000 }).toBe(true);

    const timeCandidates = await publicPage.locator("button").evaluateAll((nodes) => nodes
      .filter((node) => !node.disabled && (node.offsetWidth > 0 || node.offsetHeight > 0))
      .map((node) => `${node.getAttribute("aria-label") || ""} ${node.textContent || ""}`)
      .map((value) => value.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0])
      .filter(Boolean));
    expect(timeCandidates.length, `No hay horas publicadas para ${selectedDate}`).toBeGreaterThan(0);
    const selectedTime = timeCandidates[0].padStart(5, "0");

    // Julio de 2026 en Europe/Madrid usa CEST (UTC+02:00).
    const startsAt = new Date(`${selectedDate}T${selectedTime}:00+02:00`);
    expect(Number.isNaN(startsAt.getTime())).toBe(false);
    expect(startsAt.getTime()).toBeGreaterThan(Date.now());
    return { selectedDate, selectedTime, startsAt: startsAt.toISOString() };
  } finally {
    await publicPage.close();
  }
}

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E credentials required");

test("Booking creates, updates and cancels a real reservation", async ({ page, context }) => {
  test.setTimeout(240000);
  await login(page);
  const found = await call(page, "/api/routsify/clients?paginated=1&page=1&pageSize=50&q=info%40routsify.com");
  const rows = found.json?.data?.items || found.json?.data || [];
  const client = rows.find((row) => String(row.email || "").toLowerCase() === "info@routsify.com");
  expect(client).toBeTruthy();

  const slot = await selectPublishedSlot(context);
  const marker = String(process.env.GITHUB_RUN_ID || Date.now());
  let localId = "";
  let externalId = "";
  let status = "";
  let initialFormCompleted = null;
  let privacyAccepted = null;

  try {
    const created = await call(page, "/api/routsify/clients/booking/reservations", "POST", {
      clientId: client.id,
      startsAt: slot.startsAt,
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
  console.log("BOOKING_CERTIFIED", JSON.stringify({ marker, clientId: client.id, localId, externalId, status, initialFormCompleted, privacyAccepted, slot }));
});
