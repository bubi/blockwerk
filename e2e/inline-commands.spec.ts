import { expect, test, type Page } from "@playwright/test";
async function planning(page: Page) {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1440) <= 860)
    await page.getByRole("tab", { name: "Notizen", exact: true }).click();
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(page.locator('[data-block-id="b1"]')).toBeVisible();
}
async function notes(page: Page, count = 2) {
  const block = page.locator('[data-block-id="b1"]');
  const composer = block.getByLabel("Neue Zeile");
  const values = Array.from(
    { length: count },
    (_, index) => `Inline ${Date.now()} ${index}`,
  );
  const ids = [];
  for (const value of values) {
    await composer.fill(value);
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
    const row = block
      .locator("[data-item-id]")
      .filter({ has: page.locator(`textarea:has-text("${value}")`) });
    await expect(row).toBeVisible();
    ids.push((await row.getAttribute("data-item-id"))!);
  }
  return { block, values, ids };
}
test("merge runs at a selected row without visiting the composer and survives reload", async ({
  page,
}) => {
  await planning(page);
  const { values, ids } = await notes(page, 3);
  const first = page.locator(`[data-item-id="${ids[0]}"]`);
  await first.locator("textarea").focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.type("/merge");
  const menu = page.getByRole("region", { name: "Befehle für aktuelle Zeile" });
  await expect(menu.getByRole("option", { name: /\/merge/ })).toContainText(
    "3 markierte",
  );
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(first.locator("textarea")).toHaveValue(
    values.map((value) => `• ${value}`).join("\n"),
  );
  await expect(page.locator(`[data-item-id="${ids[1]}"]`)).toHaveCount(0);
  await planning(page);
  await expect(first.locator("textarea")).toHaveValue(
    values.map((value) => `• ${value}`).join("\n"),
  );
});
test("merge offers the adjacent pair without a prior range selection", async ({
  page,
}) => {
  await planning(page);
  const { values, ids } = await notes(page);
  const first = page.locator(`[data-item-id="${ids[0]}"]`);
  await first.locator("textarea").focus();
  await first.locator("textarea").press("/");
  const menu = page.getByRole("region", { name: "Befehle für aktuelle Zeile" });
  await menu.getByLabel("Zeilenbefehl", { exact: true }).fill("/merge");
  const option = menu.getByRole("option", { name: /\/merge/ });
  await expect(option).toContainText("2 benachbarte");
  await expect(menu).toContainText(values[0]!);
  await expect(menu).toContainText(values[1]!);
  await option.click();
  await expect(first.locator("textarea")).toHaveValue(
    `• ${values[0]}\n• ${values[1]}`,
  );
});
test("commands convert in place, preserve text and can be cancelled or inserted literally", async ({
  page,
}) => {
  await planning(page);
  const { values, ids } = await notes(page, 1);
  const row = page.locator(`[data-item-id="${ids[0]}"]`);
  const field = row.locator("textarea");
  await field.focus();
  await field.press("Home");
  await page.keyboard.type("/task");
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue(values[0]!);
  await expect(field).toBeFocused();
  await page.keyboard.type("/task");
  await page.keyboard.press("Enter");
  await expect(row.getByRole("checkbox")).toBeVisible();
  await expect(field).toHaveValue(values[0]!);
  await row.locator("textarea").focus();
  await row.locator("textarea").press("/");
  await row.getByLabel("Zeilenbefehl", { exact: true }).fill("/heading");
  await row.getByLabel("Zeilenbefehl", { exact: true }).press("Enter");
  await expect(row).toHaveAttribute("data-heading", "1");
  await row.locator("textarea").focus();
  await row.locator("textarea").press("/");
  await row.getByLabel("Zeilenbefehl", { exact: true }).fill("/note");
  await row.getByLabel("Zeilenbefehl", { exact: true }).press("Enter");
  await expect(row).not.toHaveAttribute("data-heading", "1");
  await field.focus();
  await field.press("Home");
  await page.keyboard.type("/note");
  await page.keyboard.press("Shift+Enter");
  await expect(field).toHaveValue(`/note${values[0]}`);
});
test("a failed inline merge retains every original and the active selection", async ({
  page,
}) => {
  await planning(page);
  const { values, ids } = await notes(page);
  await page.route("**/api/items/merge", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "conflict", message: "Geändert" },
      }),
    }),
  );
  const first = page.locator(`[data-item-id="${ids[0]}"]`);
  await first.locator("textarea").focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.type("/merge");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Befehl nicht gespeichert.", { exact: false }),
  ).toBeVisible();
  for (const [index, id] of ids.entries())
    await expect(page.locator(`[data-item-id="${id}"] textarea`)).toHaveValue(
      values[index]!,
    );
  await expect(first).toHaveCSS("background-color", "rgb(232, 246, 236)");
  await page.getByRole("button", { name: "Befehle schließen" }).click();
});
test("a mobile row exposes commands and a reference conversion keeps identity", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await planning(page);
  const { values, ids } = await notes(page, 1);
  const row = page.locator(`[data-item-id="${ids[0]}"]`);
  await row.locator("textarea").focus();
  await row.locator("textarea").press("/");
  await row.getByLabel("Zeilenbefehl", { exact: true }).fill("/ref");
  await row.getByLabel("Zeilenbefehl", { exact: true }).press("Enter");
  await row.getByLabel("Zielblock").selectOption("b2");
  await row.getByRole("button", { name: "In Verweis umwandeln" }).click();
  await expect(row.getByRole("button", { name: /Zum Block/ })).toBeVisible();
  await expect(row.locator("textarea")).toHaveValue(values[0]!);
  expect(
    await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
  ).toBe(true);
});

test("Jour Fix moves a note with the same identity and also exposes inline commands", async ({
  page,
}) => {
  await planning(page);
  const { values, ids } = await notes(page, 1);
  const row = page.locator(`[data-item-id="${ids[0]}"]`);
  await row.locator("textarea").focus();
  await row.locator("textarea").press("/");
  await row.getByLabel("Zeilenbefehl", { exact: true }).fill("/jfx");
  await row.getByLabel("Zeilenbefehl", { exact: true }).press("Enter");
  await row
    .getByLabel("Jour-Fix-Ablage")
    .selectOption({ label: "Lena Brandt" });
  await row.getByRole("button", { name: "In Jour Fix verschieben" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: /^Lena Brandt(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  await expect(row.getByLabel("Jour-Fix-Thema")).toHaveValue(values[0]!);
  await row.getByLabel("Jour-Fix-Thema").focus();
  await row.getByLabel("Jour-Fix-Thema").press("Home");
  await page.keyboard.type("/heading");
  await page.keyboard.press("Escape");
  await expect(row.getByLabel("Jour-Fix-Thema")).toHaveValue(values[0]!);
});
