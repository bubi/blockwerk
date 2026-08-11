import { expect, test } from "@playwright/test";

test("a page's blocks appear in date-descending order with their items", async ({
  page,
}) => {
  await page.goto("/");

  // Default space is the first topic with pages (Kundenfeedback); navigate to
  // Roadmap Q3 → Planung, which has two blocks (b2 today, b1 two days ago).
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const blocks = page.locator("[data-block-id]");
  // The page may carry more blocks (e.g. a Jour-Fix block left by the jfx
  // specs) — what must hold is the relative order of the two seed blocks.
  const older = page.locator("[data-block-id='b1']");
  await expect(older).toBeVisible();
  await expect(page.locator("[data-block-id='b2']")).toBeVisible();
  const order = await blocks.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-block-id")),
  );
  expect(order.indexOf("b2")).toBeLessThan(order.indexOf("b1"));

  // The older block still renders its grouped items (heading + tasks).
  await expect(older.locator("[data-item-id='b1-h1']")).toBeVisible();
  await expect(older.locator("[data-item-id='b1-t1']")).toBeVisible();
});
