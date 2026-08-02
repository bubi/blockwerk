import { describe, expect, it } from "vitest";
import { getTestDb } from "./testing/get-test-db.ts";
import { createSpace } from "./spaces.ts";
import { createPage } from "./pages.ts";
import { createBlock } from "./blocks.ts";
import { createItem } from "./items.ts";
import { loadCalendarWindow } from "./calendar.ts";

const NOW = 1_700_000_000_000;
const DAY = "2026-08-10";
const OTHER_DAY = "2026-08-11";

describe("loadCalendarWindow", () => {
  it("finds a task due date and an event on the same day, without the block itself", async () => {
    const db = await getTestDb();
    await createSpace(db, { id: "cal-space", name: "cal", kind: "topic", short: "CA" }, NOW);
    const page = await createPage(db, { id: "cal-page", spaceId: "cal-space", title: "cal" }, NOW);
    await createBlock(db, { id: "cal-block", pageId: page.id, templateId: null, title: "cal block", date: DAY }, NOW);
    await createItem(
      db,
      { id: "cal-task", blockId: "cal-block", position: 1000, kind: "task", text: "task", dueDate: DAY, assigneeSpaceId: null },
      NOW,
    );
    await createItem(
      db,
      { id: "cal-event", blockId: "cal-block", position: 2000, kind: "event", text: "event", eventDate: DAY, eventTime: "14:00" },
      NOW,
    );
    // Noise, one day off — must not show up in the window below.
    await createBlock(db, { id: "cal-other-block", pageId: page.id, templateId: null, title: "other", date: OTHER_DAY }, NOW);
    await createItem(
      db,
      { id: "cal-other-task", blockId: "cal-block", position: 3000, kind: "task", text: "other", dueDate: OTHER_DAY, assigneeSpaceId: null },
      NOW,
    );

    const window = await loadCalendarWindow(db, DAY, DAY);

    expect(Object.hasOwn(window, "blocks")).toBe(false);
    expect(window.dueTasks.map((item) => item.id)).toEqual(["cal-task"]);
    expect(window.events.map((item) => item.id)).toEqual(["cal-event"]);
  });

  it("a dated block without dated items produces no calendar entry", async () => {
    // A day with no items anywhere in the shared test DB.
    const emptyDay = "2026-08-20";
    const db = await getTestDb();
    await createSpace(db, { id: "cal2-space", name: "cal2", kind: "topic", short: "C2" }, NOW);
    const page = await createPage(db, { id: "cal2-page", spaceId: "cal2-space", title: "cal2" }, NOW);
    await createBlock(db, { id: "cal2-block", pageId: page.id, templateId: null, title: "cal block", date: emptyDay }, NOW);

    const window = await loadCalendarWindow(db, emptyDay, emptyDay);

    expect(Object.hasOwn(window, "blocks")).toBe(false);
    expect(window.dueTasks).toEqual([]);
    expect(window.events).toEqual([]);
  });
});
