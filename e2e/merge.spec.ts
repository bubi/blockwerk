import { expect, test } from "@playwright/test";

test("Shift+Arrow selects notes and the slash command merges them into one list point", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const composer = b1.getByLabel("Neue Zeile");
  // A unique tag keeps this run's notes apart from any text another spec
  // leaves behind (interaction.spec uses the same seed block).
  const tag = Math.random().toString(36).slice(2, 7);
  const first = `Punkt ${tag} eins`;
  const second = `Punkt ${tag} zwei`;
  const noteValues = () =>
    b1
      .locator("li[data-item-id] textarea[aria-label='Notiz']")
      .evaluateAll((els) => els.map((el) => el.value));
  // Clicking after Enter must not race the focus hand-over to the new row —
  // confirm the composer actually holds focus before typing.
  const focusComposer = async () => {
    await composer.click();
    await expect(composer).toBeFocused();
  };
  const createNote = async (text: string) => {
    await focusComposer();
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    await expect
      .poll(
        async () =>
          (await noteValues()).filter((value) => value === text).length,
      )
      .toBe(1);
  };

  const notesBefore = await noteValues();
  await createNote(first);
  await createNote(second);

  // Select both with Shift+ArrowDown from the first row.
  const firstRow = b1
    .locator("li[data-item-id]")
    .filter({ has: page.locator(`textarea:has-text("${tag} eins")`) });
  await firstRow.locator("textarea").focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(firstRow).toHaveCSS("background-color", "rgb(232, 246, 236)");

  // Merge through the slash menu.
  await focusComposer();
  await page.keyboard.type("/");
  await page.getByRole("option", { name: /\/merge/ }).click();

  // The two notes collapsed into one list-point row with the exact text.
  await expect
    .poll(async () => (await noteValues()).length)
    .toBe(notesBefore.length + 1);
  const values = await noteValues();
  expect(
    values.filter((value) => value === `• ${first}\n• ${second}`),
  ).toHaveLength(1);
  expect(values.filter((value) => value === first)).toHaveLength(0);
  expect(values.filter((value) => value === second)).toHaveLength(0);
});

test("the merge command is locked with a reason when a heading sits in the selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const b1 = page.locator("[data-block-id='b1']");
  const composer = b1.getByLabel("Neue Zeile");

  // b1-n1 (note) is followed by b1-h2 (heading) in display order.
  const note = b1.locator("[data-item-id='b1-n1']");
  await note.locator("textarea").focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");

  await composer.click();
  await page.keyboard.type("/");
  const option = page.getByRole("option", { name: /\/merge/ });
  await expect(option).toHaveAttribute("aria-disabled", "true");
  await expect(option).toContainText(
    "Nur Notizen zusammenfassen — keine Aufgaben, Termine, Verweise oder Überschriften.",
  );
});
