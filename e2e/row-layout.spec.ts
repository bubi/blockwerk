import { expect, test } from "@playwright/test";

test("short rows stay compact, commands are contextual and wrapped text resizes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  const block = page.locator('[data-block-id="b1"]');
  const composer = block.getByLabel("Neue Zeile");
  const text = `Layout ${Date.now()} kurze Notiz`;
  await composer.fill(text);
  await composer.press("Enter");
  await expect(composer).toHaveValue("");
  const createdRow = block
    .locator("[data-item-id]")
    .filter({ has: page.locator(`textarea:has-text("${text}")`) });
  await expect(createdRow).toBeVisible();
  const rowId = await createdRow.getAttribute("data-item-id");
  const row = block.locator(`[data-item-id="${rowId}"]`);
  const field = row.locator("textarea");
  const command = row.getByRole("button", { name: "Zeilenbefehle öffnen" });
  await page.getByLabel("Durchsuchen").focus();
  await page.mouse.move(0, 0);
  await expect(command).toHaveCount(0);
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(44);
  const inputBox = (await field.boundingBox())!;
  const editBox = (await row
    .getByRole("button", { name: "Eintrag bearbeiten" })
    .boundingBox())!;
  expect(Math.abs(inputBox.y - editBox.y)).toBeLessThanOrEqual(2);
  await field.focus();
  await field.press("Home");
  await page.keyboard.type("/merge");
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue(text);
  await field.fill(`${text}/`);
  await expect(row.getByLabel("Zeilenbefehl", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue(text);
  const long =
    "Diese Notiz hat ausreichend langen Text, damit sie auf dem schmalen Bildschirm automatisch auf mehrere vollständig lesbare Zeilen umbricht.";
  await field.fill(long);
  await expect(
    page.getByRole("status").filter({ hasText: "Alles gespeichert" }),
  ).toBeVisible();
  const desktopHeight = (await field.boundingBox())!.height;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Notizen", exact: true }).click();
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();
  const mobileField = block.locator("textarea").filter({ hasText: long });
  await expect(mobileField).toBeVisible();
  await expect
    .poll(async () => (await mobileField.boundingBox())!.height)
    .toBeGreaterThan(desktopHeight);
  expect(
    await mobileField.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
  expect(
    await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
  ).toBe(true);
});
