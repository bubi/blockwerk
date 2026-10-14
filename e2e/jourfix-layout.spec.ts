import { expect, test } from "@playwright/test";

test("Jour Fix uses the shared card and multiline editor with stable IDs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  const normal = page.locator('[data-block-id="b1"]');
  const normalCard = await normal.evaluate(
    "el => { const s = getComputedStyle(el); return { background: s.backgroundColor, radius: s.borderRadius, padding: s.padding, border: s.borderColor }; }",
  );
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  const pane = page.locator("[class*=jourfix]");
  const card = pane.locator("[data-block-id]").first();
  await expect(card).toBeVisible();
  expect(
    await card.evaluate(
      "el => { const s = getComputedStyle(el); return { background: s.backgroundColor, radius: s.borderRadius, padding: s.padding, border: s.borderColor }; }",
    ),
  ).toEqual(normalCard);
  const text = `JFX layout ${Date.now()}\nZweite Zeile\nDritte Zeile`;
  const composer = card.getByLabel("Neue Zeile");
  await composer.fill(text);
  await composer.press("Enter");
  await expect(composer).toHaveValue("");
  const match = pane.locator("[data-item-id]").filter({
    has: page.locator(`textarea:has-text("${text.split("\n")[0]}")`),
  });
  await expect(match).toBeVisible();
  const id = await match.getAttribute("data-item-id");
  const row = pane.locator(`[data-item-id="${id}"]`);
  await expect(row.getByLabel("Notiz", { exact: true })).toHaveValue(text);
  expect(
    await row
      .locator("textarea")
      .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
  await row.locator("textarea").focus();
  await row.locator("textarea").press("End");
  await page.keyboard.press("Escape");
  await page.keyboard.type("/heading");
  await page.keyboard.press("Escape");
  await expect(row.locator("textarea")).toHaveValue(text);
  await row.locator("textarea").press("End");
  await row.locator("textarea").press("Enter");
  const next = row
    .locator("xpath=following-sibling::li[1]")
    .getByLabel("Notiz", { exact: true });
  await expect(next).toHaveValue("");
  await expect(next).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "Alles gespeichert" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  await expect(row.locator("textarea")).toHaveValue(text);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Notizen", exact: true }).click();
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  await expect(row.locator("textarea")).toHaveValue(text);
  expect(
    await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
  ).toBe(true);
});

test("first Jour-Fix write keeps its draft if saving fails after creating the real block", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Tomas Kirsch(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  const pane = page.locator("[class*=jourfix]");
  await expect(pane.locator("[data-block-id]")).toBeVisible();
  await page.route("**/api/items/*", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "unavailable", message: "Offline" },
          }),
        })
      : route.continue(),
  );
  const field = pane.getByLabel("Neue Zeile");
  await field.fill("Entwurf für das nächste Gespräch");
  await field.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(field).toHaveValue("Entwurf für das nächste Gespräch");
});
