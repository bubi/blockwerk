import { expect, test } from "@playwright/test";

async function planning(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(page.locator('[data-block-id="b1"]')).toBeVisible();
}

test("Jour Fix loads persisted person themes after reload and allows direct capture", async ({
  page,
}) => {
  await planning(page);
  const composer = page
    .locator('[data-block-id="b1"]')
    .getByLabel("Neue Zeile");
  await composer.fill("/jfx");
  await page.getByRole("option", { name: /\/jfx/ }).click();
  const theme = `Cold theme ${Date.now()}`;
  await composer.fill(`${theme} @lena`);
  await composer.press("Enter");
  await composer.press("Enter");
  await expect(composer).toHaveValue("");
  await page.reload();
  await page.getByRole("button", { name: /^Lena Brandt(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  const pane = page.locator("[class*=jourfix]");
  await expect(
    pane.getByLabel("Jour-Fix-Thema").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(pane.locator(`input[value="${theme}"]`)).toBeVisible();
  const input = pane.getByLabel("Neue Zeile");
  await input.fill(`Direct ${theme}`);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await expect(pane.locator(`input[value="Direct ${theme}"]`)).toBeVisible();
});

test("composer retains its draft when a write fails", async ({ page }) => {
  await planning(page);
  await page.route("**/api/items/*", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":{"code":"internal"}}',
        })
      : route.continue(),
  );
  const composer = page
    .locator('[data-block-id="b1"]')
    .getByLabel("Neue Zeile");
  await composer.fill("Keep this draft");
  await composer.press("Enter");
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(composer).toHaveValue("Keep this draft");
  await page.unroute("**/api/items/*");
  await composer.press("Enter");
  await expect(composer).toHaveValue("");
});

test("dialog traps keyboard focus and returns it on cancellation", async ({
  page,
}) => {
  await planning(page);
  await page
    .getByRole("button", { name: "Roadmap Q3 entfernen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const cancel = dialog.getByRole("button", { name: "Abbrechen" });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Löschen", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
