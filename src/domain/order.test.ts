import { describe, expect, it } from "vitest";
import { item } from "./fixtures.ts";
import { groupBlockItems, orderBlockItems } from "./order.ts";

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
