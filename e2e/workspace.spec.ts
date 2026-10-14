import { expect, test } from "@playwright/test";
async function planning(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(page.locator('[data-block-id="b1"]')).toBeVisible();
}
test("quick capture stores a note in the chosen area", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Erfassen", exact: true }).click();
  const capture = page.getByRole("region", { name: "Schnell erfassen" });
  await capture.getByLabel("Ablage").selectOption({ label: "Roadmap Q3" });
  const text = `Quick note ${Date.now()}`;
  const field = capture.getByLabel("Neue Zeile");
  await field.fill(text);
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await planning(page);
  await expect(
    page.locator("[data-item-id] textarea").filter({ hasText: text }),
  ).toBeVisible();
});
test("task metadata can be edited without recreating the item", async ({
  page,
}) => {
  await planning(page);
  const row = page.locator('[data-item-id="b1-t1"]');
  await row
    .getByRole("button", { name: "Eintrag bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Eintrag bearbeiten" });
  await dialog.getByLabel("Zuständig").selectOption({ label: "Amira Sy" });
  await dialog.getByLabel("Fällig", { exact: true }).fill("2026-10-20");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row.getByText("AS", { exact: true })).toBeVisible();
  await planning(page);
  await row
    .getByRole("button", { name: "Eintrag bearbeiten", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Fällig", { exact: true }),
  ).toHaveValue("2026-10-20");
});
test("conversion and deletion undo retain the original identity and content", async ({
  page,
}) => {
  await planning(page);
  const row = page.locator('[data-item-id="b2-n2"]');
  const original = await row.locator("textarea").inputValue();
  await row
    .getByRole("button", { name: "Eintrag bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Art", { exact: true }).selectOption("task");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row.getByRole("checkbox")).toBeVisible();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(row.getByRole("checkbox")).toHaveCount(0);
  await expect(row.locator("textarea")).toHaveValue(original);
  await row
    .getByRole("button", { name: "Zeile entfernen", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(row.locator("textarea")).toHaveValue(original);
});
test("an exact search hit keeps its permalink and focus after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Durchsuchen").fill("Kapazitätsplan");
  await page
    .getByRole("button", { name: /^Aufgabe Kapazitätsplan für Q3 aufstellen/ })
    .click();
  await expect(page).toHaveURL(/item=b1-t1/);
  await page.reload();
  await expect(page.locator('[data-item-id="b1-t1"] textarea')).toBeFocused();
});
test("mobile work is visible early and scope tabs support arrow keys", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const first = page.locator("li[data-item-id]").first();
  await expect(first).toBeVisible();
  expect((await first.boundingBox())!.y).toBeLessThan(650);
  expect(
    await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
  ).toBe(true);
  const team = page.getByRole("tab", { name: "Ganzes Team", exact: true });
  await team.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Nur meine", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("template menu supports arrows and returns focus with Escape", async ({
  page,
}) => {
  await planning(page);
  const trigger = page.getByRole("button", {
    name: "Block anlegen",
    exact: true,
  });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Vorlage wählen" });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem").last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
test("nested template confirmation cancels alone and restores modal focus", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Vorlagen bearbeiten", exact: true })
    .click();
  const manager = page.getByRole("dialog", {
    name: "Vorlagen bearbeiten",
    exact: true,
  });
  const remove = manager.getByRole("button", { name: /entfernen$/ }).first();
  await remove.click();
  const confirm = page.getByRole("dialog", {
    name: "Löschen bestätigen",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(manager).toBeVisible();
  await expect(remove).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(manager).toHaveCount(0);
});
