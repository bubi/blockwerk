import { expect, test } from "@playwright/test";

test("a page's blocks appear in date-descending order with their items", async ({ page }) => {
  await page.goto("/");

  // Default space is the first topic with pages (Kundenfeedback); navigate to
  // Roadmap Q3 → Planung, which has two blocks (b2 today, b1 two days ago).
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: "Planung", exact: true }).click();

  const blocks = page.locator("[data-block-id]");
  await expect(blocks).toHaveCount(2);
  await expect(blocks.nth(0)).toHaveAttribute("data-block-id", "b2");
  await expect(blocks.nth(1)).toHaveAttribute("data-block-id", "b1");

  // The older block still renders its grouped items (heading + tasks).
  const older = page.locator("[data-block-id='b1']");
  await expect(older.locator("[data-item-id='b1-h1']")).toBeVisible();
  await expect(older.locator("[data-item-id='b1-t1']")).toBeVisible();
});
