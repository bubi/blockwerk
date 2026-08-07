import { expect, test } from "@playwright/test";

test("toggling a task updates the block view, the person overview, and survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();

  const checkbox = page.locator("[data-item-id='b1-t1'] [role='checkbox']");

  // Repeatable runs: bring the task to a known unchecked state first.
  if ((await checkbox.getAttribute("aria-checked")) === "true") {
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-checked", "false");
  }

  await checkbox.click();
  await expect(checkbox).toHaveAttribute("aria-checked", "true");

  // The assigned-tasks overview of the assignee (Tomas) no longer lists the
  // checked task, but still shows his other open task.
  await page.getByRole("button", { name: /^Tomas Kirsch(?:\s+\d+)?$/ }).click();
  await page.getByRole("button", { name: /^Aufgaben/ }).click();
  await expect(page.locator("[data-item-id='b1-t1']")).toHaveCount(0);
  await expect(page.locator("[data-item-id='b2-t1']")).toBeVisible();

  // A full reload keeps the task checked — the change is persisted, not local.
  await page.goto("/");
  await page.getByRole("button", { name: /^Roadmap Q3(?:\s+\d+)?$/ }).click();
  await expect(checkbox).toHaveAttribute("aria-checked", "true");
});
