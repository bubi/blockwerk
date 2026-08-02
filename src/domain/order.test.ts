import { describe, expect, it } from "vitest";
import { block, item } from "./fixtures.ts";
import { groupBlockItems, orderBlockItems, orderPageBlocks } from "./order.ts";

describe("orderBlockItems", () => {
  it("orders notes and refs by position, then tasks, then events chronologically", () => {
    const items = [
      item({ id: "event-late", kind: "event", position: 100, eventDate: "2026-08-10", eventTime: "09:00" }),
      item({ id: "task-z", kind: "task", position: 5000, text: "z" }),
      item({ id: "ref", kind: "ref", position: 200, refBlockId: "target" }),
      item({ id: "note-b", kind: "note", position: 2000, text: "b" }),
      item({ id: "event-early", kind: "event", position: 300, eventDate: "2026-08-09", eventTime: "10:00" }),
      item({ id: "note-a", kind: "note", position: 1000, text: "a", heading: 1 }),
      item({ id: "task-a", kind: "task", position: 4000, text: "a" }),
    ];

    expect(orderBlockItems(items).map((entry) => entry.id)).toEqual([
      "ref",
      "note-a",
      "note-b",
      "task-a",
      "task-z",
      "event-early",
      "event-late",
    ]);
  });

  it("sorts refs with the notes by position — the ref rule", () => {
    const items = [
      item({ id: "note-1", kind: "note", position: 1000 }),
      item({ id: "ref", kind: "ref", position: 1500, refBlockId: "target" }),
      item({ id: "note-2", kind: "note", position: 2000 }),
    ];
    expect(orderBlockItems(items).map((entry) => entry.id)).toEqual(["note-1", "ref", "note-2"]);
  });

  it("orders events by date then time regardless of position", () => {
    const items = [
      item({ id: "e3", kind: "event", position: 1000, eventDate: "2026-08-10", eventTime: "14:00" }),
      item({ id: "e2", kind: "event", position: 2000, eventDate: "2026-08-10", eventTime: "09:00" }),
      item({ id: "e1", kind: "event", position: 3000, eventDate: "2026-08-09", eventTime: "10:00" }),
    ];
    expect(orderBlockItems(items).map((entry) => entry.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("breaks position ties deterministically by id", () => {
    const items = [
      item({ id: "b", kind: "note", position: 1000 }),
      item({ id: "a", kind: "note", position: 1000 }),
      item({ id: "c", kind: "note", position: 1000 }),
    ];
    expect(orderBlockItems(items).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const items = [item({ id: "b", kind: "note", position: 2000 }), item({ id: "a", kind: "note", position: 1000 })];
    orderBlockItems(items);
    expect(items.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("sits a task's notes directly under it, not in the notes group", () => {
    const items = [
      item({ id: "event", kind: "event", position: 9000, eventDate: "2026-08-10", eventTime: "09:00" }),
      item({ id: "task-b", kind: "task", position: 5000, text: "b" }),
      item({ id: "note-b2", kind: "note", position: 5200, text: "b2", parentItemId: "task-b" }),
      item({ id: "note-1", kind: "note", position: 1000, text: "1" }),
      item({ id: "task-a", kind: "task", position: 4000, text: "a" }),
      item({ id: "note-b1", kind: "note", position: 5100, text: "b1", parentItemId: "task-b" }),
      item({ id: "note-a", kind: "note", position: 4100, text: "a-note", parentItemId: "task-a" }),
      item({ id: "note-2", kind: "note", position: 2000, text: "2" }),
    ];

    expect(orderBlockItems(items).map((entry) => entry.id)).toEqual([
      "note-1",
      "note-2",
      "task-a",
      "note-a",
      "task-b",
      "note-b1",
      "note-b2",
      "event",
    ]);
  });

  it("sorts a task's notes by position among themselves, regardless of their parent's position", () => {
    const items = [
      item({ id: "task", kind: "task", position: 1000, text: "t" }),
      item({ id: "child-late", kind: "note", position: 9000, text: "late", parentItemId: "task" }),
      item({ id: "child-early", kind: "note", position: 1100, text: "early", parentItemId: "task" }),
    ];
    expect(orderBlockItems(items).map((entry) => entry.id)).toEqual(["task", "child-early", "child-late"]);
  });
});

describe("groupBlockItems", () => {
  it("splits a block into notes (with refs), tasks, and events", () => {
    const groups = groupBlockItems([
      item({ id: "task", kind: "task", position: 4000 }),
      item({ id: "ref", kind: "ref", position: 1500, refBlockId: "x" }),
      item({ id: "note", kind: "note", position: 1000 }),
      item({ id: "event", kind: "event", position: 5000, eventDate: "2026-08-10" }),
    ]);
    expect(groups.notes.map((entry) => entry.id)).toEqual(["note", "ref"]);
    expect(groups.tasks.map((entry) => entry.id)).toEqual(["task"]);
    expect(groups.events.map((entry) => entry.id)).toEqual(["event"]);
  });
});

describe("orderPageBlocks", () => {
  it("orders a page's blocks by date descending, id ascending on ties", () => {
    const blocks = [
      block({ id: "mid", pageId: "p1", date: "2026-08-10" }),
      block({ id: "new", pageId: "p1", date: "2026-08-20" }),
      block({ id: "old", pageId: "p1", date: "2026-08-01" }),
      block({ id: "tie-b", pageId: "p1", date: "2026-08-20" }),
      block({ id: "tie-a", pageId: "p1", date: "2026-08-20" }),
    ];
    expect(orderPageBlocks(blocks).map((entry) => entry.id)).toEqual(["new", "tie-a", "tie-b", "mid", "old"]);
  });

  it("does not mutate the input", () => {
    const blocks = [block({ id: "old", pageId: "p1", date: "2026-08-01" }), block({ id: "new", pageId: "p1", date: "2026-08-20" })];
    orderPageBlocks(blocks);
    expect(blocks.map((entry) => entry.id)).toEqual(["old", "new"]);
  });
});
