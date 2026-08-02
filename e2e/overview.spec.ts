import { expect, test, type Page } from "@playwright/test";

/**
 * The task overview ("Heute", docs/adr/0011): the start view that sections
 * every open task, shows the team workload, groups overdue by person, and
 * jumps back to the source block. Expectations are computed from the seeded
 * dates relative to the current day, so the spec holds on any run date.
 */

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TODAY = todayIso();

/** The seed's open tasks (b3-t1 is done and must never appear). */
const OPEN_TASKS = [
  { id: "b1-t1", due: "2026-08-05" },
  { id: "b1-t2", due: "2026-08-03" },
  { id: "b1-t3", due: "2026-08-01" },
  { id: "b2-t1", due: "2026-08-09" },
  { id: "b4-t1", due: "2026-08-04" },
];

async function expandFoldedSections(page: Page) {
  for (const label of [/Später fällig/, /Ohne Datum/]) {
    const button = page.getByRole("button", { name: label });
    if (await button.count()) await button.click();
  }
}

test("the Heute view is the start view: every open task, sectioned and with the workload", async ({ page }) => {
  await page.goto("/");

  // The start view, not a space: the team overview with its workload.
  await expect(page.getByRole("heading", { name: "Auslastung" })).toBeVisible();

  // Later/undated tasks sit in folded sections on some dates — open them.
  await expandFoldedSections(page);

  for (const task of OPEN_TASKS) {
    await expect(page.locator(`[data-item-id='${task.id}']`)).toBeVisible();
  }

  // The done seed task is not an open task anywhere.
  await expect(page.locator("[data-item-id='b3-t1']")).toHaveCount(0);

  // The workload names every person space. (Earlier specs in the shared local
  // DB may have added tasks, so exact counts are not asserted.)
  const load = page.locator("section", { has: page.getByRole("heading", { name: "Auslastung" }) });
  await expect(load).toContainText("Amira Sy");
  await expect(load).toContainText("Lena Brandt");
  await expect(load).toContainText("Tomas Kirsch");
});

test("overdue tasks are grouped by person and a row jumps to its source block", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Auslastung" })).toBeVisible();

  const overdue = OPEN_TASKS.filter((task) => task.due < TODAY);
  if (overdue.length > 0) {
    await expect(page.getByRole("heading", { name: /Überfällig/ })).toBeVisible();
    // Grouped under person headings (not one flat list).
    await expect(page.getByRole("heading", { name: /(Brandt|Kirsch|Sy)/ })).toBeVisible();
  }

  // A row's body navigates to the block it came from.
  await page.locator("[data-item-id='b1-t2'] button").nth(1).click();
  await expect(page.locator("[data-block-id='b1']")).toBeVisible();
});

test("the scope toggle persists and, with an identity, narrows to my tasks", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Auslastung" })).toBeVisible();

  // The team view shows task checkboxes; make sure folded tasks are open.
  await expandFoldedSections(page);
  await expect(page.getByRole("checkbox").first()).toBeVisible();

  const mine = page.getByRole("tab", { name: "Nur meine" });
  await mine.click();
  await expect(mine).toHaveAttribute("aria-selected", "true");

  // With the dev identity (Lena), "nur meine" shows her tasks and hides the
  // others — open the folded sections first so it holds on any run date.
  await expandFoldedSections(page);
  await expect(page.locator("[data-item-id='b1-t3']")).toBeVisible();
  await expect(page.locator("[data-item-id='b4-t1']")).toBeVisible();
  await expect(page.locator("[data-item-id='b1-t1']")).toHaveCount(0);

  // Own rows are marked as such.
  await expect(page.locator("[data-item-id='b1-t3']").getByText("ich", { exact: true })).toBeVisible();

  // The choice is a per-device preference and survives a reload.
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Nur meine" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-item-id='b1-t3']")).toBeVisible();
});
