import { expect, test } from "@playwright/test";

test("a task created in the person's Aufgaben view lands in an Ohne-Kontext block, assigned to the person", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Tomas Kirsch(?:\s+\d+)?$/ }).click();

  // The Aufgaben view opens with a composer (Feature 3, docs/adr/0016).
  const composer = page.locator("[class*=person]").getByLabel("Neue Zeile");
  await expect(composer).toBeVisible();
  await composer.click();
  await page.keyboard.type("/task");
  await page.getByRole("option", { name: /\/task/ }).click();
  await page.keyboard.type("Protokoll nachtragen !morgen");
  await page.keyboard.press("Enter");

  // The task shows in the person's overview, assigned to her (the row only
  // appears there when the assignee matches; the origin block carries the
  // context).
  const row = page
    .locator("[data-item-id]")
    .filter({ hasText: "Protokoll nachtragen" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Ohne Kontext", { exact: true })).toBeVisible();

  // The Ohne-Kontext block appears on the person's Notizseite.
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await page.getByRole("button", { name: /^Tomas Kirsch(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Notizen", exact: true }).click();
  await expect(
    page.locator("[data-block-id]").filter({ hasText: "Ohne Kontext" }),
  ).toBeVisible();
});
