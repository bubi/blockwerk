import { describe, expect, it } from "vitest";
import { block, item } from "./fixtures.ts";
import { projectCalendar } from "./calendar.ts";

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
