import { test, expect } from "@playwright/test";

test("inspect public Booking fields without submitting", async ({ page }) => {
  test.setTimeout(120000);
  const response = await page.goto("https://call.routsify.com/", { waitUntil: "networkidle" });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(500);
  const fields = await page.locator("input, select, textarea, button").evaluateAll((nodes) => nodes.map((node) => ({
    tag: node.tagName.toLowerCase(),
    type: node.getAttribute("type"),
    name: node.getAttribute("name"),
    id: node.id || null,
    value: node.getAttribute("value"),
    placeholder: node.getAttribute("placeholder"),
    text: (node.textContent || "").trim().slice(0, 200),
    ariaLabel: node.getAttribute("aria-label"),
    required: node.hasAttribute("required"),
  })));
  console.log("BOOKING_PUBLIC_FIELDS", JSON.stringify(fields));
  expect(fields.length).toBeGreaterThan(0);
});
