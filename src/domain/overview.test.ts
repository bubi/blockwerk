import { describe, expect, it } from "vitest";
import type { SpaceRow } from "../../shared/db.ts";
import { item, space } from "./fixtures.ts";
import {
  buildTaskOverview,
  inOverviewWindow,
  OVERVIEW_WINDOW_DAYS,
  rowsForPerson,
  type OverviewRow,
} from "./overview.ts";

const TODAY = "2026-08-10";

function taskRow(id: string, due: string | null, assignee: string | null): OverviewRow {
  return {
    item: item({ id, kind: "task", text: id, dueDate: due, assigneeSpaceId: assignee }),
    block: { id: "blk", pageId: "pg", spaceId: "sp", title: "Block", date: "2026-08-01" },
  };
}

function eventRow(id: string, date: string, time: string | null): OverviewRow {
  return {
    item: item({ id, kind: "event", text: id, eventDate: date, eventTime: time }),
    block: { id: "blk", pageId: "pg", spaceId: "sp", title: "Block", date: "2026-08-01" },
  };
}

const lena: SpaceRow = space({ id: "lena", kind: "person", name: "Lena Brandt" });
const tomas: SpaceRow = space({ id: "tomas", kind: "person", name: "Tomas Kirsch" });
const topic: SpaceRow = space({ id: "feed", kind: "topic", name: "Kundenfeedback" });
const spaces = [lena, tomas, topic];

describe("buildTaskOverview sections", () => {
  it("sections tasks by overdue, the 8-day window, later, and undated", () => {
    const view = buildTaskOverview(
      [
        taskRow("late-2", "2026-08-20", "lena"),
        taskRow("undated", null, null),
        taskRow("overdue-1", "2026-08-01", "lena"),
        taskRow("day-first", "2026-08-10", null),
        taskRow("overdue-2", "2026-08-09", "tomas"),
        taskRow("day-last", "2026-08-17", null),
        taskRow("day-mid", "2026-08-12", null),
      ],
      [],
      [],
      spaces,
      TODAY,
    );

    expect(view.overdue.map((row) => row.item.id)).toEqual(["overdue-1", "overdue-2"]);
    expect(view.days.map((day) => day.date)).toEqual(["2026-08-10", "2026-08-12", "2026-08-17"]);
    expect(view.later.map((row) => row.item.id)).toEqual(["late-2"]);
    expect(view.undated.map((row) => row.item.id)).toEqual(["undated"]);
  });

  it("orders day tasks by id and day events by time before tasks", () => {
    const view = buildTaskOverview(
      [taskRow("b", "2026-08-10", null), taskRow("a", "2026-08-10", null)],
      [],
      [eventRow("e2", "2026-08-10", "14:00"), eventRow("e1", "2026-08-10", "09:00")],
      spaces,
      TODAY,
    );

    expect(view.days).toHaveLength(1);
    const day = view.days[0]!;
    expect(day.events.map((row) => row.item.id)).toEqual(["e1", "e2"]);
    expect(day.tasks.map((row) => row.item.id)).toEqual(["a", "b"]);
  });

  it("keeps empty days out of the window", () => {
    const view = buildTaskOverview([taskRow("d", "2026-08-12", null)], [], [], spaces, TODAY);
    expect(view.days.map((day) => day.date)).toEqual(["2026-08-12"]);
  });
});

describe("inOverviewWindow", () => {
  it("is inclusive on both ends of the 8-day window", () => {
    expect(inOverviewWindow(TODAY, TODAY)).toBe(true);
    expect(inOverviewWindow("2026-08-17", TODAY)).toBe(true);
    expect(inOverviewWindow("2026-08-09", TODAY)).toBe(false);
    expect(inOverviewWindow("2026-08-18", TODAY)).toBe(false);
    expect(OVERVIEW_WINDOW_DAYS).toBe(8);
  });
});

describe("workload", () => {
  it("counts open and overdue tasks per person, only persons with open tasks", () => {
    const view = buildTaskOverview(
      [
        taskRow("l1", "2026-08-01", "lena"),
        taskRow("l2", "2026-08-12", "lena"),
        taskRow("t1", "2026-08-11", "tomas"),
        taskRow("o1", null, null),
      ],
      [
        taskRow("l1", "2026-08-01", "lena"),
        taskRow("l2", "2026-08-12", "lena"),
        taskRow("t1", "2026-08-11", "tomas"),
        taskRow("o1", null, null),
      ],
      [],
      spaces,
      TODAY,
    );

    expect(view.workload).toEqual([
      { space: lena, open: 2, late: 1 },
      { space: tomas, open: 1, late: 0 },
    ]);
    expect(view.orphanOpen).toBe(1);
  });

  it("derives the workload from the full task set, not the scoped one", () => {
    const all = [taskRow("l1", "2026-08-01", "lena"), taskRow("t1", "2026-08-11", "tomas")];
    const view = buildTaskOverview([taskRow("l1", "2026-08-01", "lena")], all, [], spaces, TODAY);
    expect(view.workload).toEqual([
      { space: lena, open: 1, late: 1 },
      { space: tomas, open: 1, late: 0 },
    ]);
  });
});

describe("overdue grouping", () => {
  it("groups overdue by person, name order, orphan last", () => {
    const view = buildTaskOverview(
      [
        taskRow("o1", "2026-08-01", null),
        taskRow("l1", "2026-08-02", "lena"),
        taskRow("t1", "2026-08-03", "tomas"),
      ],
      [],
      [],
      spaces,
      TODAY,
    );

    expect(view.overdueByPerson.map((group) => group.person?.id ?? null)).toEqual(["lena", "tomas", null]);
    expect(view.overdueByPerson[2]!.tasks.map((row) => row.item.id)).toEqual(["o1"]);
  });
});

describe("person mode", () => {
  it("filters to one assignee; events are the team view's concern", () => {
    const all = [taskRow("l1", "2026-08-09", "lena"), taskRow("t1", "2026-08-12", "tomas")];
    const mine = rowsForPerson(all, "lena");
    // A person's view passes no events; with them, the function still renders
    // them (that is the team selector's decision, not the projection's).
    const withoutEvents = buildTaskOverview(mine, all, [], spaces, TODAY);
    const withEvents = buildTaskOverview(mine, all, [eventRow("e1", "2026-08-12", "10:00")], spaces, TODAY);

    expect(mine.map((row) => row.item.id)).toEqual(["l1"]);
    expect(withoutEvents.overdue.map((row) => row.item.id)).toEqual(["l1"]);
    expect(withoutEvents.days).toEqual([]);
    expect(withEvents.days[0]!.events.map((row) => row.item.id)).toEqual(["e1"]);
  });
});
