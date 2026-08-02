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
    expect(view.taskNotes).toEqual(new Map());
    expect(view.order).toEqual(["heading", "ref", "note-under", "task", "event"]);
  });

  it("attaches a task's notes under the task in the display order", () => {
    const view = buildBlockView([
      item({ id: "note", kind: "note", position: 1000 }),
      item({ id: "task-b", kind: "task", position: 4000, text: "b" }),
      item({ id: "task-b-note-2", kind: "note", position: 5000, text: "n2", parentItemId: "task-b" }),
      item({ id: "task-b-note-1", kind: "note", position: 4500, text: "n1", parentItemId: "task-b" }),
      item({ id: "task-a", kind: "task", position: 3000, text: "a" }),
      item({ id: "event", kind: "event", position: 6000, eventDate: "2026-08-10", eventTime: "09:00" }),
    ]);

    expect(view.notes.map((row) => row.item.id)).toEqual(["note"]);
    expect(view.tasks.map((row) => row.id)).toEqual(["task-a", "task-b"]);
    expect(view.taskNotes.get("task-b")?.map((row) => row.id)).toEqual(["task-b-note-1", "task-b-note-2"]);
    expect(view.taskNotes.get("task-a")).toBeUndefined();
    expect(view.order).toEqual([
      "note",
      "task-a",
      "task-b",
      "task-b-note-1",
      "task-b-note-2",
      "event",
    ]);
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
    expect(view).toEqual({ notes: [], tasks: [], taskNotes: new Map(), events: [], order: [] });
  });
});
