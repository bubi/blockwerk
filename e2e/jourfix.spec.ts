import { expect, test } from "@playwright/test";

test("/jfx collects a theme in the space's Jour Fix and a meeting block can take it over", async ({
  page,
}) => {
  const tag = Math.random().toString(36).slice(2, 7);
  const theme = `Thema ${tag}`;
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const composer = b1.getByLabel("Neue Zeile");
  await composer.click();
  await page.keyboard.type("/jfx");
  await page.getByRole("option", { name: /\/jfx/ }).click();
  await page.keyboard.type(theme);
  await page.keyboard.press("Enter");

  // The theme shows in the space's Jour-Fix entry.
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  await expect(
    page.locator(`[class*=jourfix] input[value="${theme}"]`),
  ).toBeVisible();

  // A meeting block takes it over: the item moves, it is not copied.
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await b1.getByRole("button", { name: /Themen aus dem Jour Fix/ }).click();
  await b1
    .locator("[class*=jfxrow]")
    .filter({ hasText: theme })
    .locator("input[type=checkbox]")
    .check();
  await b1.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(
    b1
      .locator("li[data-item-id]")
      .filter({ has: page.locator(`textarea:has-text("${theme}")`) }),
  ).toBeVisible();

  // The theme is gone from the open list — it lives in the block now.
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  await expect(
    page.locator(`[class*=jourfix] input[value="${theme}"]`),
  ).not.toBeVisible();
});

test("/jfx with @Person collects the theme in that person's Jour Fix", async ({
  page,
}) => {
  const tag = Math.random().toString(36).slice(2, 7);
  const theme = `Privates Thema ${tag}`;
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const composer = page
    .locator("[data-block-id='b1']")
    .getByLabel("Neue Zeile");
  await composer.click();
  await page.keyboard.type("/jfx");
  await page.getByRole("option", { name: /\/jfx/ }).click();
  await page.keyboard.type(`${theme} @lena`);
  await page.keyboard.press("Enter"); // pick the mention
  await page.keyboard.press("Enter"); // commit the theme

  // The theme lands in Lena's Jour Fix, not the current space's.
  await page.getByRole("button", { name: /^Lena Brandt(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Jour Fix/ }).click();
  await expect(
    page.locator(`[class*=jourfix] input[value="${theme}"]`),
  ).toBeVisible();
});
