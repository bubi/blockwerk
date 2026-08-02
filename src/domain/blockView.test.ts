import { describe, expect, it } from "vitest";
import { item } from "./fixtures.ts";
import { buildBlockView } from "./blockView.ts";

describe("buildBlockView", () => {
  it("composes grouping, heading indentation, and display order", () => {
    const view = buildBlockView([
      item({ id: "event", kind: "event", eventDate: "2026-08-10", eventTime: "09:00" }),
      item({ id: "task", kind: "task", position: 4000 }),
      item({ id: "ref", kind: "ref", position: 1500, refBlockId: "x" }),
      item({ id: "note-under", kind: "note", position: 2000 }),
      item({ id: "heading", kind: "note", position: 1000, heading: 1 }),
    ]);

    expect(view.notes.map((row) => row.item.id)).toEqual(["heading", "ref", "note-under"]);
    expect(view.notes.map((row) => row.indent)).toEqual([false, true, true]);
    expect(view.tasks.map((row) => row.id)).toEqual(["task"]);
    expect(view.events.map((row) => row.id)).toEqual(["event"]);
    expect(view.order).toEqual(["heading", "ref", "note-under", "task", "event"]);
  });

  it("keeps the display order stable with only refs and notes present", () => {
    const view = buildBlockView([
      item({ id: "note-2", kind: "note", position: 2000 }),
      item({ id: "ref", kind: "ref", position: 1500, refBlockId: "x" }),
      item({ id: "note-1", kind: "note", position: 1000 }),
    ]);
    expect(view.order).toEqual(["note-1", "ref", "note-2"]);
  });

  it("returns empty sections for an empty block", () => {
    const view = buildBlockView([]);
    expect(view).toEqual({ notes: [], tasks: [], events: [], order: [] });
  });
});
