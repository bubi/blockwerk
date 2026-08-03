import { expect, test } from "@playwright/test";

test("search finds block titles and item text and jumps to the source block", async ({
  page,
}) => {
  await page.goto("/");

  // A block-title hit and an item-text hit for the same query.
  await page.getByLabel("Durchsuchen").fill("Q3");
  const blockHit = page.getByRole("button", {
    name: /^Block · Meeting Quartalsplanung Q3/,
  });
  const itemHit = page.getByRole("button", {
    name: /^Task Kapazitätsplan für Q3 aufstellen/,
  });
  await expect(blockHit).toBeVisible();
  await expect(itemHit).toBeVisible();

  // Item hits carry their kind and the path back to the block.
  await expect(itemHit).toContainText("Task");
  await expect(itemHit).toContainText(
    "Roadmap Q3 · Planung · Quartalsplanung Q3",
  );

  // Clicking a result jumps to the block and leaves the search.
  await itemHit.click();
  await expect(page.getByLabel("Durchsuchen")).toHaveValue("");
  await expect(page.locator("[data-block-id='b1']")).toBeVisible();
  await expect(page.locator("[data-item-id='b1-t1'] textarea")).toHaveValue(
    "Kapazitätsplan für Q3 aufstellen",
  );
});

test("a search without hits shows the empty state and can be left", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Durchsuchen").fill("nirgendwo-sonst");
  await expect(page.getByText("Kein Treffer")).toBeVisible();
  await expect(
    page.getByText("Suche nach Blocktiteln, Notizzeilen, Tasks oder Terminen."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Suche verlassen" }).click();
  await expect(page.getByLabel("Durchsuchen")).toHaveValue("");
  await expect(page.locator("[data-block-id]").first()).toBeVisible();
});
