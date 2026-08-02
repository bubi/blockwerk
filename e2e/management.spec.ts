import { expect, test, type Page } from "@playwright/test";

/**
 * The management surface (the rest of phase 2b): creating and deleting
 * spaces, adding and renaming pages, editing templates, and creating blocks.
 * Every test cleans up after itself (deletes the spaces/templates it
 * created), so it does not pollute the seeded state the other specs rely on.
 */

const spaceButton = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}(?:\\s+\\d+)?$`) });

test("creating a topic space derives the short code and adds a Notizen page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Themen hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Name des Bereichs").fill("Release Plan");
  await page.getByRole("button", { name: "Anlegen", exact: true }).dispatchEvent("click");

  const space = spaceButton(page, "Release Plan");
  await expect(space).toBeVisible();
  await expect(space).toContainText("RP");

  // The new space is selected and shows its freshly created "Notizen" page.
  await expect(page.getByRole("button", { name: "Notizen", exact: true })).toBeVisible();
  await expect(page.getByText("Diese Seite ist leer.")).toBeVisible();

  // Clean up.
  await page.getByRole("button", { name: "Release Plan entfernen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(space).toHaveCount(0);
});

test("deleting a person space keeps foreign tasks and only drops the assignment", async ({ page }) => {
  await page.goto("/");

  // A host topic and a person, so a task can live outside the person's space.
  await page.getByRole("button", { name: "Themen hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Name des Bereichs").fill("Host Raum");
  await page.getByRole("button", { name: "Anlegen", exact: true }).dispatchEvent("click");
  await page.getByRole("button", { name: "Personen hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Name des Bereichs").fill("Kim Lee");
  await page.getByRole("button", { name: "Anlegen", exact: true }).dispatchEvent("click");
  await expect(spaceButton(page, "Kim Lee")).toBeVisible();

  // A block in the host topic, with a task assigned to Kim. Wait for the page
  // view to settle first — a late page GET could otherwise drop the block
  // that "Block anlegen" is about to create.
  await spaceButton(page, "Host Raum").dispatchEvent("click");
  await expect(page.getByRole("button", { name: "Block anlegen" })).toBeVisible();
  await page.getByRole("button", { name: "Block anlegen" }).dispatchEvent("click");
  await expect(page.getByRole("menuitem", { name: /Meeting/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /Meeting/ }).dispatchEvent("click");
  const hostBlock = page.locator("[data-block-id]").filter({ has: page.locator("input[value='Neuer Meeting']") });
  await expect(hostBlock).toBeVisible();

  const composer = hostBlock.getByLabel("Neue Zeile");
  await composer.fill("/task");
  await page.keyboard.press("Enter");
  // The trailing space closes the @-mention list, so Enter commits the task
  // instead of picking a person.
  await composer.fill("Check @kim ");
  await page.keyboard.press("Enter");
  await expect(hostBlock.locator('input[value="Check"]')).toBeVisible();
  await expect(hostBlock.getByText("KL", { exact: true })).toBeVisible();

  // Deleting Kim asks in a modal dialog that states the consequence.
  await page.getByRole("button", { name: "Kim Lee entfernen" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "Löschen bestätigen" })).toContainText(
    "Tasks in anderen Bereichen verlieren nur ihre Zuständigkeit",
  );
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(spaceButton(page, "Kim Lee")).toHaveCount(0);

  // The foreign task stays — only its assignment is gone.
  await expect(hostBlock.locator('input[value="Check"]')).toBeVisible();
  await expect(hostBlock.getByText("KL", { exact: true })).toHaveCount(0);

  // Clean up the host space (its block and the task go with it).
  await page.getByRole("button", { name: "Host Raum entfernen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(spaceButton(page, "Host Raum")).toHaveCount(0);
});

test("pages can be created and renamed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Themen hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Name des Bereichs").fill("Seiten Test");
  await page.getByRole("button", { name: "Anlegen", exact: true }).dispatchEvent("click");

  await page.getByRole("button", { name: "Seite hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Neue Seite").fill("Retrospektive");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Retrospektive", exact: true })).toBeVisible();
  await expect(page.getByText("Diese Seite ist leer.")).toBeVisible();

  await page.getByRole("button", { name: "Retrospektive umbenennen" }).dispatchEvent("click");
  await page.getByLabel("Seitentitel umbenennen").fill("Retro");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Retro", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retrospektive", exact: true })).toHaveCount(0);

  // Clean up.
  await page.getByRole("button", { name: "Seiten Test entfernen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(spaceButton(page, "Seiten Test")).toHaveCount(0);
});

test("templates can be added, edited, and deleted", async ({ page }) => {
  await page.goto("/");
  // The start view is the "Heute" overview; open a page so the block bar
  // (and with it "Block anlegen") is rendered.
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await page.getByRole("button", { name: "Block anlegen" }).dispatchEvent("click");
  await expect(page.getByRole("menuitem", { name: /Templates bearbeiten/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /Templates bearbeiten/ }).dispatchEvent("click");
  const dialog = page.getByRole("dialog", { name: "Templates bearbeiten" });
  await expect(dialog).toBeVisible();

  // Add a template and shape it: name, hue, seed lines ("#" makes a heading).
  await dialog.getByRole("button", { name: "Template hinzufügen" }).dispatchEvent("click");
  const newCard = dialog.locator("[data-template-id]").filter({ has: page.locator("input[value='Neues Template']") });
  await expect(newCard).toHaveCount(1);
  await newCard.getByLabel("Name des Templates").fill("Daily");
  const dailyCard = dialog.locator("[data-template-id]").filter({ has: page.locator("input[value='Daily']") });
  await dailyCard.getByLabel("Farbe").selectOption("moss");
  await dailyCard.getByLabel("Vorbelegte Zeilen").fill("# Teilnehmer\n# Agenda");

  // The block menu now offers it.
  await dialog.getByRole("button", { name: "Schließen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Block anlegen" }).dispatchEvent("click");
  await expect(page.getByRole("menuitem", { name: /Daily/ })).toBeVisible();

  // Back into the manager to delete it again — with a modal confirmation.
  await page.getByRole("menuitem", { name: /Templates bearbeiten/ }).dispatchEvent("click");
  await dailyCard.getByRole("button", { name: "Daily entfernen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(dailyCard).toHaveCount(0);

  // The block menu no longer offers it.
  await dialog.getByRole("button", { name: "Schließen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Block anlegen" }).dispatchEvent("click");
  await expect(page.getByRole("menuitem", { name: /Daily/ })).toHaveCount(0);
});

test("a block is created from a template with its seed lines", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Themen hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Name des Bereichs").fill("Block Test");
  await page.getByRole("button", { name: "Anlegen", exact: true }).dispatchEvent("click");

  const blocksBefore = await page.locator("[data-block-id]").count();
  await expect(page.getByRole("button", { name: "Block anlegen" })).toBeVisible();
  await page.getByRole("button", { name: "Block anlegen" }).dispatchEvent("click");
  await expect(page.getByRole("menuitem", { name: /Meeting/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /Meeting/ }).dispatchEvent("click");

  await expect(page.locator("[data-block-id]")).toHaveCount(blocksBefore + 1);
  const block = page.locator("[data-block-id]").filter({ has: page.locator("input[value='Neuer Meeting']") });
  await expect(block).toBeVisible();
  // Seed lines become headings ("#" lines) inside the new block.
  await expect(block.locator("input[aria-label='Überschrift'][value='Teilnehmer']")).toBeVisible();
  await expect(block.locator("input[aria-label='Überschrift'][value='Agenda']")).toBeVisible();
  await expect(block.locator("input[aria-label='Überschrift'][value='Entscheidungen']")).toBeVisible();
  // The new block's composer holds the focus.
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Neue Zeile");

  // Clean up.
  await page.getByRole("button", { name: "Block Test entfernen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(spaceButton(page, "Block Test")).toHaveCount(0);
});

test("rows and blocks can be deleted, with an in-line block confirmation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Themen hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Name des Bereichs").fill("Del Test");
  await page.getByRole("button", { name: "Anlegen", exact: true }).dispatchEvent("click");

  await expect(page.getByRole("button", { name: "Block anlegen" })).toBeVisible();
  await page.getByRole("button", { name: "Block anlegen" }).dispatchEvent("click");
  await expect(page.getByRole("menuitem", { name: /Meeting/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /Meeting/ }).dispatchEvent("click");
  const block = page.locator("[data-block-id]").filter({ has: page.locator("input[value='Neuer Meeting']") });
  await expect(block).toBeVisible();
  const blockId = await block.getAttribute("data-block-id");
  const card = page.locator(`[data-block-id='${blockId}']`);

  // The visible row button removes a single line.
  const headingRow = card.locator("[data-item-id]").filter({ has: page.locator("input[value='Teilnehmer']") });
  await headingRow.getByRole("button", { name: "Zeile entfernen" }).dispatchEvent("click");
  await expect(card.locator("input[aria-label='Überschrift'][value='Teilnehmer']")).toHaveCount(0);
  await expect(card.locator("input[aria-label='Überschrift'][value='Agenda']")).toBeVisible();

  // Deleting the block asks in a modal dialog and states the consequence.
  await card.getByRole("button", { name: "Block entfernen" }).dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "Löschen bestätigen" })).toContainText(
    "Verweise von außen verlieren ihr Ziel",
  );
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(card).toHaveCount(0);

  // Clean up the space.
  await page.getByRole("button", { name: "Del Test entfernen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(spaceButton(page, "Del Test")).toHaveCount(0);
});

test("a page can be deleted and the selection moves on", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Themen hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Name des Bereichs").fill("Page Del");
  await page.getByRole("button", { name: "Anlegen", exact: true }).dispatchEvent("click");

  await page.getByRole("button", { name: "Seite hinzufügen" }).dispatchEvent("click");
  await page.getByLabel("Neue Seite").fill("Doku");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Doku", exact: true })).toBeVisible();
  // Wait for the page's initial load to settle (the block bar only renders
  // for a loaded page view) — otherwise a late GET can re-add the row the
  // DELETE just removed.
  await expect(page.getByRole("button", { name: "Block anlegen" })).toBeVisible();

  await page.getByRole("button", { name: "Doku entfernen" }).dispatchEvent("click");
  await expect(page.getByText("mit ihren Blöcken löschen?")).toBeVisible();
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");

  // The page is gone; the selection falls back to the remaining "Notizen".
  await expect(page.getByRole("button", { name: "Doku", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Notizen", exact: true })).toBeVisible();

  // Clean up the space.
  await page.getByRole("button", { name: "Page Del entfernen" }).dispatchEvent("click");
  await page.getByRole("button", { name: "Löschen" }).dispatchEvent("click");
  await expect(spaceButton(page, "Page Del")).toHaveCount(0);
});
