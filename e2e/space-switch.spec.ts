import { expect, test } from "@playwright/test";

test("switching spaces loads the right data", async ({ page }) => {
  await page.goto("/");

  // Roadmap Q3 → Planung: its two blocks, nothing from other spaces.
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await expect(page.locator("[data-block-id='b2']")).toBeVisible();
  await expect(page.locator("[data-block-id='b1']")).toBeVisible();
  await expect(page.locator("[data-block-id='b3']")).toHaveCount(0);

  // Kundenfeedback → Interviews: the interview block, none of the roadmap's.
  await page.getByRole("button", { name: /^Kundenfeedback(?:\s+\d+)?$/ }).click();
  await expect(page.locator("[data-block-id='b3']")).toBeVisible();
  await expect(page.locator("[data-block-id='b2']")).toHaveCount(0);
  await expect(page.locator("[data-block-id='b1']")).toHaveCount(0);

  // A person space shows their open tasks; done tasks stay hidden.
  await page.getByRole("button", { name: /^Amira Sy(?:\s+\d+)?$/ }).click();
  await expect(page.locator("[data-item-id='b1-t2']")).toBeVisible();
  await expect(page.locator("[data-item-id='b3-t1']")).toHaveCount(0);
});
