import { test, expect } from "@playwright/test";

const hasCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

async function signIn(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Salir", exact: true })).toBeVisible();
}

async function expectOperationalPage(page, path) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `No se recibió respuesta al abrir ${path}`).not.toBeNull();
  expect(response.status(), `${path} devolvió HTTP ${response.status()}`).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("Could not embed because more than one relationship was found");
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
}

async function api(page, path, method = "GET", body, allowError = false) {
  const result = await page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    return { status: response.status, payload: await response.json().catch(() => null) };
  }, { path, method, body });
  if (!allowError) {
    expect(result.status, JSON.stringify(result.payload)).toBeLessThan(300);
    expect(result.payload?.ok, JSON.stringify(result.payload)).toBe(true);
  }
  return result;
}

test("health endpoint is operational", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.status).toBe("up");
});

test("login page renders the access form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});

test("protected pages redirect an anonymous browser to login", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByLabel("Email")).toBeVisible();
});

test.describe("authenticated critical-path smoke", () => {
  test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD GitHub secrets to enable authenticated smoke tests.");

  test("admin can sign in and open every operational module", async ({ page }) => {
    await signIn(page);
    const modulePaths = ["/hoy", "/control", "/clientes", "/solicitudes", "/expedientes", "/propuestas", "/compras", "/proveedores", "/comunicaciones", "/informes", "/tareas", "/facturacion", "/contratos", "/documentos", "/viajeros", "/cierre", "/integraciones", "/seguridad", "/ajustes"];
    for (const path of modulePaths) await expectOperationalPage(page, path);
    await page.goto("/hoy");
    await expect(page.getByText("Próxima mejor acción", { exact: true })).toBeVisible();
    await page.goto("/comunicaciones");
    await expect(page.getByRole("heading", { name: "Comunicaciones", exact: true })).toBeVisible();
  });

  test("clients pagination, global search and import controls work", async ({ page }) => {
    await signIn(page);
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
    const pageSize = page.getByLabel(/Mostrar .* clientes por página/);
    await expect(pageSize.locator("option")).toHaveText(["50", "100", "150", "200"]);
    await pageSize.selectOption("100");
    await expect(page.getByText(/Mostrando 1-\d+ de \d+ clientes/)).toBeVisible();
    const filters = page.locator("form.client-filters");
    const search = filters.getByPlaceholder("Buscar en todos los clientes por nombre, email, teléfono o NIF...");
    await search.fill("info@routsify.com");
    const [searchResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/routsify/clients?") && response.url().includes("q=info%40routsify.com")),
      filters.getByRole("button", { name: "Buscar", exact: true }).click(),
    ]);
    expect(searchResponse.ok()).toBeTruthy();
    await expect(page.getByText("info@routsify.com", { exact: true }).first()).toBeVisible();
    await filters.getByRole("button", { name: "Limpiar", exact: true }).click();
    await expect(page.getByRole("link", { name: "Descargar plantilla", exact: true })).toHaveAttribute("href", "/api/routsify/clients/import/template");
    await page.getByRole("button", { name: "Importar clientes", exact: true }).click();
    await expect(page.getByLabel("Archivo CSV")).toBeVisible();
  });

  test("real Booking create update and cancel", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    const listed = (await api(page, "/api/routsify/clients?paginated=1&page=1&pageSize=50&q=info%40routsify.com")).payload;
    const clients = listed?.data?.items || listed?.data || [];
    const client = clients.find((row) => String(row.email || "").toLowerCase() === "info@routsify.com");
    expect(client).toBeTruthy();
    const from = new Date(Date.now() + 86_400_000).toISOString();
    const to = new Date(Date.now() + 45 * 86_400_000).toISOString();
    const availability = (await api(page, `/api/routsify/clients/booking/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&timezone=Europe%2FMadrid&duration=30`)).payload;
    const slot = (availability?.data?.slots || []).find((row) => row.available !== false && row.startsAt);
    const fallback = new Date(Date.now() + 21 * 86_400_000);
    fallback.setUTCHours(10, 0, 0, 0);
    const startsAt = slot?.startsAt || fallback.toISOString();
    const tag = `[PRUEBA E2E ROUTSIFY ${process.env.GITHUB_RUN_ID || Date.now()}]`;
    let localId = "";
    let externalId = "";
    let cancelledStatus = "";
    try {
      const created = (await api(page, "/api/routsify/clients/booking/reservations", "POST", { clientId: client.id, startsAt, durationMinutes: 30, timezone: "Europe/Madrid", notes: `${tag} Reserva real temporal.` })).payload;
      localId = String(created?.data?.booking?.id || "");
      externalId = String(created?.data?.remote?.externalBookingId || created?.data?.booking?.external_booking_id || "");
      expect(localId).not.toBe("");
      expect(externalId).not.toBe("");
      await api(page, `/api/routsify/clients/booking/reservations/${encodeURIComponent(localId)}`, "PATCH", { notes: `${tag} Actualización real verificada.` });
    } finally {
      if (localId) {
        const cancelled = await api(page, `/api/routsify/clients/booking/reservations/${encodeURIComponent(localId)}`, "DELETE", undefined, true);
        cancelledStatus = String(cancelled.payload?.data?.booking?.status || cancelled.payload?.data?.remote?.status || "").toLowerCase();
        expect(cancelled.status, JSON.stringify(cancelled.payload)).toBeLessThan(300);
        expect(cancelled.payload?.ok, JSON.stringify(cancelled.payload)).toBe(true);
      }
    }
    expect(cancelledStatus).toContain("cancel");
    console.log("BOOKING_E2E", JSON.stringify({ localId, externalId, cancelledStatus, availabilitySlots: availability?.data?.slots?.length || 0, usedFallback: !slot }));
  });
});
