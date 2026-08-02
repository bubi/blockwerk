import { describe, expect, it } from "vitest";
import { block, item } from "./fixtures.ts";
import { fromISODate } from "./dates.ts";
import { isOverdueTask, ledgerRows, monthLedger, projectCalendar, type LedgerDay } from "./calendar.ts";

describe("projectCalendar", () => {
  it("returns only dated objects inside the inclusive window", () => {
    const window = projectCalendar(
      [block({ id: "b-in", date: "2026-08-10" }), block({ id: "b-out", date: "2026-08-01" }), block({ id: "b-edge", date: "2026-08-11" })],
      [
        item({ id: "t-in", kind: "task", dueDate: "2026-08-10" }),
        item({ id: "t-out", kind: "task", dueDate: "2026-08-12" }),
        item({ id: "e-in", kind: "event", eventDate: "2026-08-10", eventTime: "14:00" }),
        item({ id: "e-out", kind: "event", eventDate: "2026-08-12" }),
        item({ id: "note", kind: "note" }),
      ],
      "2026-08-10",
      "2026-08-11",
    );

    expect(window.blocks.map((entry) => entry.id)).toEqual(["b-in", "b-edge"]);
    expect(window.dueTasks.map((entry) => entry.id)).toEqual(["t-in"]);
    expect(window.events.map((entry) => entry.id)).toEqual(["e-in"]);
  });

  it("orders blocks chronologically, tasks by due date, events by date and time", () => {
    const window = projectCalendar(
      [block({ id: "b2", date: "2026-08-20" }), block({ id: "b1", date: "2026-08-10" })],
      [
        item({ id: "t2", kind: "task", dueDate: "2026-08-20" }),
        item({ id: "t1", kind: "task", dueDate: "2026-08-10" }),
        item({ id: "e3", kind: "event", eventDate: "2026-08-10", eventTime: "14:00" }),
        item({ id: "e1", kind: "event", eventDate: "2026-08-10", eventTime: "09:00" }),
        item({ id: "e2", kind: "event", eventDate: "2026-08-09", eventTime: "10:00" }),
      ],
      "2026-08-01",
      "2026-08-31",
    );

    expect(window.blocks.map((entry) => entry.id)).toEqual(["b1", "b2"]);
    expect(window.dueTasks.map((entry) => entry.id)).toEqual(["t1", "t2"]);
    expect(window.events.map((entry) => entry.id)).toEqual(["e2", "e1", "e3"]);
  });
});

describe("monthLedger", () => {
  it("enumerates every day of the window and groups content onto it", () => {
    const window = projectCalendar(
      [block({ id: "b", date: "2026-08-10" })],
      [
        item({ id: "t", kind: "task", dueDate: "2026-08-10" }),
        item({ id: "e", kind: "event", eventDate: "2026-08-11", eventTime: "14:00" }),
      ],
      "2026-08-10",
      "2026-08-12",
    );

    const ledger = monthLedger(window, "2026-08-10", "2026-08-12");
    expect(ledger.map((day) => day.date)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
    expect(ledger[0]!.blocks.map((entry) => entry.id)).toEqual(["b"]);
    expect(ledger[0]!.tasks.map((entry) => entry.id)).toEqual(["t"]);
    expect(ledger[0]!.events).toEqual([]);
    expect(ledger[1]!.events.map((entry) => entry.id)).toEqual(["e"]);
    expect(ledger[2]!.blocks).toEqual([]);
  });

  it("exposes the weekday index for weekend styling", () => {
    // 2026-08-10 is a Monday.
    const ledger = monthLedger(projectCalendar([], [], "2026-08-10", "2026-08-10"), "2026-08-10", "2026-08-10");
    expect(ledger[0]!.weekday).toBe(1);
  });
});

describe("ledgerRows", () => {
  it("keeps full days as sections and collapses consecutive empty days into a gap", () => {
    const days = [
      day("2026-08-01", { blocks: 1 }),
      day("2026-08-02"),
      day("2026-08-03"),
      day("2026-08-04", { tasks: 1 }),
      day("2026-08-05"),
    ];

    expect(ledgerRows(days)).toEqual([
      { type: "day", day: days[0] },
      { type: "gap", from: "2026-08-02", count: 2 },
      { type: "day", day: days[3] },
      { type: "gap", from: "2026-08-05", count: 1 },
    ]);
  });

  it("keeps a gap at the month start and end intact", () => {
    const days = [day("2026-08-01"), day("2026-08-02", { events: 1 }), day("2026-08-03"), day("2026-08-04")];

    expect(ledgerRows(days)).toEqual([
      { type: "gap", from: "2026-08-01", count: 1 },
      { type: "day", day: days[1] },
      { type: "gap", from: "2026-08-03", count: 2 },
    ]);
  });

  it("returns one section per day when no day is empty", () => {
    const days = [day("2026-08-01", { blocks: 1 }), day("2026-08-02", { tasks: 1 }), day("2026-08-03", { events: 1 })];

    expect(ledgerRows(days)).toEqual([
      { type: "day", day: days[0] },
      { type: "day", day: days[1] },
      { type: "day", day: days[2] },
    ]);
  });

  it("returns a single gap for a window with no entries at all", () => {
    const days = [day("2026-08-01"), day("2026-08-02"), day("2026-08-03")];
    expect(ledgerRows(days)).toEqual([{ type: "gap", from: "2026-08-01", count: 3 }]);
  });
});

describe("isOverdueTask", () => {
  const today = "2026-08-02";

  it("is overdue when open and due before today", () => {
    expect(isOverdueTask(item({ id: "t", kind: "task", dueDate: "2026-07-31" }), today)).toBe(true);
  });

  it("is not overdue when done, due today, or without a due date", () => {
    expect(isOverdueTask(item({ id: "t", kind: "task", dueDate: "2026-07-31", done: true }), today)).toBe(false);
    expect(isOverdueTask(item({ id: "t", kind: "task", dueDate: "2026-08-02" }), today)).toBe(false);
    expect(isOverdueTask(item({ id: "t", kind: "task", dueDate: null }), today)).toBe(false);
  });
});

/** A ledger day with the requested amount of content. */
function day(date: string, load: { blocks?: number; tasks?: number; events?: number } = {}): LedgerDay {
  return {
    date,
    weekday: fromISODate(date).getDay(),
    blocks: Array.from({ length: load.blocks ?? 0 }, (_, index) => block({ id: `${date}-b${index}`, date })),
    tasks: Array.from({ length: load.tasks ?? 0 }, (_, index) =>
      item({ id: `${date}-t${index}`, kind: "task", dueDate: date }),
    ),
    events: Array.from({ length: load.events ?? 0 }, (_, index) =>
      item({ id: `${date}-e${index}`, kind: "event", eventDate: date }),
    ),
  };
}
