const { test, expect } = require("@playwright/test");

const hasCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

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
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("protected pages redirect an anonymous browser to login", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByLabel("Email")).toBeVisible();
});

test.describe("authenticated critical-path smoke", () => {
  test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD GitHub secrets to enable authenticated smoke tests.");

  test("admin can sign in and open core operational modules", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
    await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/(hoy|clientes|expedientes|propuestas)/, { timeout: 20_000 });

    for (const path of ["/clientes", "/expedientes", "/propuestas", "/compras"]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.locator("body")).not.toContainText("Application error");
      await expect(page.locator("body")).not.toContainText("Could not embed because more than one relationship was found");
    }
  });
});
