import { expect, test } from "@playwright/test";

test("composer: /task with @Person and !morgen creates a task, visible in the block and the person's overview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const composer = page.locator("[data-block-id='b1']").getByLabel("Neue Zeile");
  await composer.click();
  await page.keyboard.type("/task");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Modus verwerfen/ })).toContainText("Task");
  await page.keyboard.type("Protokoll @tomas !morgen");
  await page.keyboard.press("Enter");

  // The task sits in its block with assignee and due date parsed from tokens.
  const row = page.locator("[data-item-id]").filter({ has: page.locator('input[value="Protokoll"]') });
  await expect(row).toBeVisible();
  await expect(row.getByText("TK", { exact: true })).toBeVisible();
  await expect(row.getByText("morgen", { exact: true })).toBeVisible();

  // The same row is shown in Tomas's assigned-tasks overview, with its
  // source block as the origin.
  await page.getByRole("button", { name: /^Tomas Kirsch(?:\s+\d+)?$/ }).click();
  const mirrored = page.locator("[data-item-id]").filter({ hasText: "Protokoll" });
  await expect(mirrored).toBeVisible();
  await expect(mirrored.getByText("Quartalsplanung Q3", { exact: true })).toBeVisible();
});

test("typing # at the line start converts a note into a heading, indenting the following line", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const converted = page.locator("[data-item-id='b2-n1'] input");
  await converted.fill("# Kontext");

  await expect(page.locator("[data-item-id='b2-n1']").getByRole("button", { name: "In normalen Text umwandeln" })).toBeVisible();
  await expect(converted).toHaveValue("Kontext");
  // The following note row is rendered indented under the heading.
  await expect(page.locator("[data-item-id='b2-n2']")).toHaveCSS("margin-left", "22px");
});

test("Enter in a heading inserts a new line directly below, not at the block end", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const noteInputs = b1.locator("input[aria-label='Notiz']");
  const noteCountBefore = await noteInputs.count();

  await b1.locator("[data-item-id='b1-h2'] input").focus();
  await page.keyboard.press("Enter");

  // A new, empty note line appears and holds the cursor.
  await expect(noteInputs).toHaveCount(noteCountBefore + 1);
  const newInput = page.locator(":focus");
  await expect(newInput).toHaveAttribute("aria-label", "Notiz");

  // Between the heading and the previously following row — not at the end.
  const headingBox = (await b1.locator("[data-item-id='b1-h2']").boundingBox())!;
  const newBox = (await newInput.boundingBox())!;
  const afterBox = (await b1.locator("[data-item-id='b1-n2']").boundingBox())!;
  expect(newBox.y).toBeGreaterThan(headingBox.y);
  expect(newBox.y).toBeLessThan(afterBox.y);
});

test("arrow keys select rows, Space toggles a task, Escape switches the mode — no mouse", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const row = (id: string) => b1.locator(`[data-item-id='${id}']`);
  const t2check = row("b1-t2").getByRole("checkbox");

  // Into the field, then Escape back to the row — that is selection mode.
  await row("b1-t1").locator("input").focus();
  await page.keyboard.press("Escape");
  await expect(row("b1-t1")).toBeFocused();

  // Arrow keys walk the rows in display order.
  await page.keyboard.press("ArrowDown");
  await expect(row("b1-t2")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(row("b1-t3")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(row("b1-t2")).toBeFocused();

  // Space on a selected task toggles it.
  if ((await t2check.getAttribute("aria-checked")) === "true") {
    await page.keyboard.press("Space");
    await expect(t2check).toHaveAttribute("aria-checked", "false");
  }
  await page.keyboard.press("Space");
  await expect(t2check).toHaveAttribute("aria-checked", "true");

  // Enter enters the field; there a Space types instead of toggling.
  await page.keyboard.press("Enter");
  await expect(row("b1-t2").locator("input")).toBeFocused();
  const before = await row("b1-t2").locator("input").inputValue();
  await page.keyboard.press(" ");
  await expect(t2check).toHaveAttribute("aria-checked", "true");
  await expect(row("b1-t2").locator("input")).toHaveValue(before + " ");
  await page.keyboard.press("Backspace");
  await expect(row("b1-t2").locator("input")).toHaveValue(before);

  // Escape returns to the row; toggle the task back for repeatable runs.
  await page.keyboard.press("Escape");
  await expect(row("b1-t2")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(t2check).toHaveAttribute("aria-checked", "false");
});

test("a change made through the composer survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const composer = page.locator("[data-block-id='b1']").getByLabel("Neue Zeile");
  await composer.click();
  await page.keyboard.type("/task");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Rechner bestellen @lena !morgen");
  await page.keyboard.press("Enter");
  await expect(page.locator('input[value="Rechner bestellen"]')).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(page.locator('input[value="Rechner bestellen"]')).toBeVisible();
});

test("composer: @ opens a filtered person list, Enter picks and remembers the person", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const composer = page.locator("[data-block-id='b1']").getByLabel("Neue Zeile");
  await composer.click();
  await page.keyboard.type("/task");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Rückschau @Le");
  await expect(page.getByRole("listbox", { name: "Person wählen" })).toBeVisible();
  await expect(page.getByRole("option", { name: /Lena Brandt/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Amira/ })).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(composer).toHaveValue("Rückschau @Lena ");
  await page.keyboard.type("!morgen");
  await expect(composer).toHaveValue("Rückschau @Lena !morgen");
  await page.keyboard.press("Enter");

  const row = page.locator("[data-item-id]").filter({ has: page.locator('input[value="Rückschau"]') });
  await expect(row).toBeVisible();
  await expect(row.getByText("LB", { exact: true })).toBeVisible();
  await expect(row.getByText("morgen", { exact: true })).toBeVisible();
});

test("a task can be checked off from its date-column card and stays visible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  // A task due today, so it sits in the current month of the date column.
  const composer = page.locator("[data-block-id='b1']").getByLabel("Neue Zeile");
  await composer.click();
  await page.keyboard.type("/task");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Kalendertest !heute");
  await page.keyboard.press("Enter");
  await expect(page.locator('input[value="Kalendertest"]')).toBeVisible();

  // The date column (the last aside) shows a card for the task; its checkbox
  // toggles done and the card stays — struck through, not removed.
  const dates = page.locator("aside").last();
  const card = dates.locator("[data-due-card]").filter({ hasText: "Kalendertest" });
  await expect(card).toBeVisible();
  await card.getByRole("checkbox").click();
  await expect(card.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await expect(card).toBeVisible();
});

test("Enter in a task adds a note under it; arrow keys walk task → notes → next task", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const row = (id: string) => b1.locator(`[data-item-id='${id}']`);
  const noteInputs = b1.locator("input[aria-label='Notiz']");
  const notesBefore = await noteInputs.count();

  // Enter in the task's field adds a note under it and puts the cursor there.
  await row("b1-t1").locator("input").focus();
  await page.keyboard.press("Enter");
  // Wait for the new note to actually hold the cursor before typing into it.
  await expect(page.locator(":focus").locator("..")).not.toHaveAttribute("data-item-id", "b1-t1");
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Notiz");
  await expect(noteInputs).toHaveCount(notesBefore + 1);
  const firstNoteId = (await page.locator(":focus").locator("..").getAttribute("data-item-id"))!;
  const firstNote = row(firstNoteId);
  await page.keyboard.type("wartet auf Freigabe");

  // The child note sits under its task — between the task and the next task.
  const t1Box = (await row("b1-t1").boundingBox())!;
  const firstBox = (await firstNote.boundingBox())!;
  const t2Box = (await row("b1-t2").boundingBox())!;
  expect(firstBox.y).toBeGreaterThan(t1Box.y);
  expect(firstBox.y).toBeLessThan(t2Box.y);

  // Enter in a child note adds the next note of the same task.
  await firstNote.locator("input").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(":focus").locator("..")).not.toHaveAttribute("data-item-id", firstNoteId);
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Notiz");
  await expect(noteInputs).toHaveCount(notesBefore + 2);
  const secondNoteId = (await page.locator(":focus").locator("..").getAttribute("data-item-id"))!;
  await page.keyboard.type("dann Teilnehmer");

  // Selection mode walks the display order: task → its notes → next task.
  await page.keyboard.press("Escape");
  await expect(page.locator(":focus")).toHaveAttribute("data-item-id", secondNoteId!);
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(":focus")).toHaveAttribute("data-item-id", firstNoteId!);
  await page.keyboard.press("ArrowUp");
  await expect(row("b1-t1")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveAttribute("data-item-id", firstNoteId!);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveAttribute("data-item-id", secondNoteId!);
  await page.keyboard.press("ArrowDown");
  await expect(row("b1-t2")).toBeFocused();
});

test("Backspace in an empty child note removes it and returns to the previous row", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const row = (id: string) => b1.locator(`[data-item-id='${id}']`);
  const noteInputs = b1.locator("input[aria-label='Notiz']");
  const notesBefore = await noteInputs.count();

  // Two notes under b1-t1, the second one left empty.
  await row("b1-t1").locator("input").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(":focus").locator("..")).not.toHaveAttribute("data-item-id", "b1-t1");
  const firstNoteId = (await page.locator(":focus").locator("..").getAttribute("data-item-id"))!;
  await page.keyboard.type("erste");
  await page.keyboard.press("Enter");
  await expect(page.locator(":focus").locator("..")).not.toHaveAttribute("data-item-id", firstNoteId);
  await expect(noteInputs).toHaveCount(notesBefore + 2);

  // Backspace in the empty child note deletes it and jumps back a row.
  await page.keyboard.press("Backspace");
  await expect(noteInputs).toHaveCount(notesBefore + 1);
  await expect(row(firstNoteId).locator("input")).toBeFocused();
});

test("the visible plus on a task row adds a note under it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const noteInputs = b1.locator("input[aria-label='Notiz']");
  const notesBefore = await noteInputs.count();

  await b1.locator("[data-item-id='b1-t2']").getByRole("button", { name: /Notiz zu/ }).click();
  await expect(noteInputs).toHaveCount(notesBefore + 1);
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Notiz");
});
