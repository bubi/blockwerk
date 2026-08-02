import { expect, test } from "@playwright/test";

/**
 * The mobile Gestalt (docs/adr/0012): below 860px the app is its own shape —
 * a tab bar (Heute · Notizen · Suche) instead of the desktop columns, no
 * date column, and a drill-down with real back navigation for Notizen.
 * Runs in a phone-sized viewport.
 */
test.use({ viewport: { width: 390, height: 844 } });

test("mobile shows the tab bar with the team overview and no date column", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "Heute" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Notizen" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Suche" })).toBeVisible();

  // "Heute" is the team overview.
  await expect(page.getByRole("heading", { name: "Auslastung" })).toBeVisible();

  // The date column is gone on mobile.
  await expect(page.getByRole("button", { name: "Vorheriger Monat" })).toHaveCount(0);
});

test("Notizen drills down Bereich → Seite → Stream and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Notizen" }).click();
  await expect(page.getByRole("heading", { name: "Bereiche" })).toBeVisible();

  // Space → pages.
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await expect(page.getByRole("button", { name: "Planung", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Architektur", exact: true })).toBeVisible();

  // Page → stream.
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(page.locator("[data-block-id='b2']")).toBeVisible();
  await expect(page.locator("[data-block-id='b1']")).toBeVisible();

  // Browser back restores the pages step of the drill-down.
  await page.goBack();
  await expect(page.getByRole("button", { name: "Planung", exact: true })).toBeVisible();

  // The in-app back button climbs back to the spaces list.
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByRole("heading", { name: "Bereiche" })).toBeVisible();
});

test("a person space leads to the Zugewiesen overview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Notizen" }).click();
  await page.getByRole("button", { name: /^Lena Brandt(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Zugewiesen/ }).click();

  await expect(page.locator("[data-item-id='b1-t3']")).toBeVisible();
  await expect(page.locator("[data-item-id='b4-t1']")).toBeVisible();
});

test("Suche opens focused, finds a block, and jumps into the stream", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Suche" }).click();
  await expect(page.getByLabel("Durchsuchen")).toBeFocused();

  await page.keyboard.type("Q3");
  const itemHit = page.getByRole("button", { name: /^Task Kapazitätsplan für Q3 aufstellen/ });
  await expect(itemHit).toBeVisible();

  // A hit jumps into the Notizen stream and leaves the search.
  await itemHit.click();
  await expect(page.getByRole("tab", { name: "Notizen" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-block-id='b1']")).toBeVisible();

  // Reopening Suche shows the cleared field.
  await page.getByRole("tab", { name: "Suche" }).click();
  await expect(page.getByLabel("Durchsuchen")).toHaveValue("");
});
