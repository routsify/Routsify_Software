import { test, expect } from "@playwright/test";

const hasCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

async function signIn(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Cerrar sesión", exact: true })).toBeVisible();
}

async function expectOperationalPage(page, path) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `No se recibió respuesta al abrir ${path}`).not.toBeNull();
  expect(response.status(), `${path} devolvió HTTP ${response.status()}`).toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
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

    const modulePaths = [
      "/hoy",
      "/control",
      "/clientes",
      "/solicitudes",
      "/expedientes",
      "/propuestas",
      "/compras",
      "/proveedores",
      "/comunicaciones",
      "/automatizaciones",
      "/informes",
      "/ajustes",
    ];

    for (const path of modulePaths) await expectOperationalPage(page, path);

    await page.goto("/hoy");
    await expect(page.getByText("Próxima mejor acción", { exact: true })).toBeVisible();

    await page.goto("/comunicaciones");
    await expect(page.getByRole("heading", { name: "Comunicaciones", exact: true })).toBeVisible();
  });

  test("historical Fillout requests stay archived and actionable", async ({ page }) => {
    await signIn(page);
    await page.goto("/solicitudes?status=archived");
    await expect(page.getByRole("heading", { name: "Solicitudes", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Archivadas/ }).first()).toBeVisible();
    await expect(page.getByText("Solicitud seleccionada", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Compró", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "No compró", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reabrir seguimiento", exact: true })).toBeVisible();
  });

  test("clients pagination, global search and import controls work", async ({ page }) => {
    await signIn(page);
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();

    const pageSize = page.getByLabel(/Mostrar .* clientes por página/);
    await expect(pageSize).toBeVisible();
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
    await expect(page.getByText(/Mostrando \d+-\d+ de \d+ coincidencias/)).toBeVisible();
    await expect(page.getByText("info@routsify.com", { exact: true }).first()).toBeVisible();
    await filters.getByRole("button", { name: "Limpiar", exact: true }).click();

    await expect(page.getByRole("link", { name: "Descargar plantilla", exact: true })).toHaveAttribute("href", "/api/routsify/clients/import/template");
    await page.getByRole("button", { name: "Importar clientes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Plantilla CSV compatible con Excel", exact: true })).toBeVisible();
    await expect(page.getByLabel("Archivo CSV")).toBeVisible();
  });

  test("integration health center reports operational state", async ({ page }) => {
    await signIn(page);
    await page.goto("/ajustes");

    const [healthResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/routsify/settings/integrations/health") && response.request().method() === "GET"),
      page.getByRole("button", { name: "Integraciones", exact: true }).click(),
    ]);
    expect(healthResponse.ok()).toBeTruthy();
    const body = await healthResponse.json();
    expect(body.ok).toBe(true);
    expect(body.data.integrations).toHaveLength(6);
    expect(body.data.integrations.every((integration) => integration.id && integration.state)).toBe(true);

    await expect(page.getByRole("heading", { name: "Herramientas conectadas", exact: true })).toBeVisible();
    await expect(page.getByText("Salud operativa", { exact: true })).toHaveCount(6);
    await expect(page.getByText("Proceso diario", { exact: true })).toBeVisible();
  });
});
