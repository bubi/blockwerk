import { describe, expect, it } from "vitest";
import { block, item, page, space, template } from "../domain/fixtures.ts";
import {
  selectCalendar,
  selectMirror,
  selectPageBlocks,
  selectSpaces,
  selectTemplates,
} from "./selectors.ts";
import { initialState, type AppState } from "./state.ts";

function withData(seed: {
  spaces?: ReturnType<typeof space>[];
  pages?: ReturnType<typeof page>[];
  blocks?: ReturnType<typeof block>[];
  items?: ReturnType<typeof item>[];
  templates?: ReturnType<typeof template>[];
  mirrorOrder?: Map<string, string[]>;
}): AppState {
  const state = initialState();
  return {
    ...state,
    spaces: new Map((seed.spaces ?? []).map((row) => [row.id, row])),
    pages: new Map((seed.pages ?? []).map((row) => [row.id, row])),
    blocks: new Map((seed.blocks ?? []).map((row) => [row.id, row])),
    items: new Map((seed.items ?? []).map((row) => [row.id, row])),
    templates: new Map((seed.templates ?? []).map((row) => [row.id, row])),
    mirrorOrder: seed.mirrorOrder ?? new Map(),
  };
}

describe("selectPageBlocks", () => {
  it("orders a page's items with the domain rule — refs among the notes", () => {
    const state = withData({
      blocks: [block({ id: "b1", pageId: "pg1", date: "2026-08-01" })],
      items: [
        item({ id: "event", kind: "event", blockId: "b1", eventDate: "2026-08-10", eventTime: "09:00" }),
        item({ id: "task", kind: "task", blockId: "b1", position: 3000 }),
        item({ id: "ref", kind: "ref", blockId: "b1", position: 1500, refBlockId: "x" }),
        item({ id: "note", kind: "note", blockId: "b1", position: 1000 }),
      ],
    });

    const blocks = selectPageBlocks(state, "pg1");
    expect(blocks[0]!.items.map((entry) => entry.id)).toEqual(["note", "ref", "task", "event"]);
  });

  it("sorts blocks of a page by date descending, id ascending", () => {
    const state = withData({
      blocks: [block({ id: "old", pageId: "pg1", date: "2026-08-01" }), block({ id: "new", pageId: "pg1", date: "2026-08-10" })],
    });
    expect(selectPageBlocks(state, "pg1").map((entry) => entry.id)).toEqual(["new", "old"]);
  });
});

describe("selectMirror", () => {
  it("returns the person's open tasks in the stored server order, referencing the same rows", () => {
    const t1 = item({ id: "t1", kind: "task", blockId: "b1", assigneeSpaceId: "p1" });
    const t2 = item({ id: "t2", kind: "task", blockId: "b1", assigneeSpaceId: "p1" });
    const state = withData({
      blocks: [block({ id: "b1", pageId: "pg1", title: "Meeting", date: "2026-08-10" })],
      items: [t1, t2, item({ id: "done", kind: "task", blockId: "b1", assigneeSpaceId: "p1", done: true })],
      mirrorOrder: new Map([["p1", ["t2", "t1"]]]),
    });

    const mirror = selectMirror(state, "p1");
    expect(mirror.map((entry) => entry.item.id)).toEqual(["t2", "t1"]);
    expect(mirror[0]!.item).toBe(state.items.get("t2"));
    expect(mirror[1]!.item).toBe(state.items.get("t1"));
    expect(mirror[0]!.block).toMatchObject({ id: "b1", pageId: "pg1", title: "Meeting", date: "2026-08-10" });
  });

  it("hides tasks that were checked off or reassigned away", () => {
    const state = withData({
      items: [
        item({ id: "open", kind: "task", blockId: "b1", assigneeSpaceId: "p1" }),
        item({ id: "done", kind: "task", blockId: "b1", assigneeSpaceId: "p1", done: true }),
        item({ id: "reassigned", kind: "task", blockId: "b1", assigneeSpaceId: "other" }),
      ],
      mirrorOrder: new Map([["p1", ["open", "done", "reassigned"]]]),
    });
    expect(selectMirror(state, "p1").map((entry) => entry.item.id)).toEqual(["open"]);
  });
});

describe("selectCalendar", () => {
  it("projects the window via the domain function", () => {
    const state = withData({
      blocks: [block({ id: "b-in", date: "2026-08-10" }), block({ id: "b-out", date: "2026-07-01" })],
      items: [
        item({ id: "t-in", kind: "task", dueDate: "2026-08-10" }),
        item({ id: "e-in", kind: "event", eventDate: "2026-08-10", eventTime: "14:00" }),
        item({ id: "note", kind: "note" }),
      ],
    });
    const window = selectCalendar(state, "2026-08-01", "2026-08-31");
    expect(window.blocks.map((entry) => entry.id)).toEqual(["b-in"]);
    expect(window.dueTasks.map((entry) => entry.id)).toEqual(["t-in"]);
    expect(window.events.map((entry) => entry.id)).toEqual(["e-in"]);
  });
});

describe("selectSpaces / selectTemplates", () => {
  it("nests pages under their space, ordered by id", () => {
    const state = withData({
      spaces: [space({ id: "b", name: "B" }), space({ id: "a", name: "A" })],
      pages: [page({ id: "p2", spaceId: "a" }), page({ id: "p1", spaceId: "a" }), page({ id: "q1", spaceId: "b" })],
      templates: [template({ id: "tpl", label: "T" })],
    });

    const spaces = selectSpaces(state);
    expect(spaces.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(spaces[0]!.pages.map((entry) => entry.id)).toEqual(["p1", "p2"]);
    expect(selectTemplates(state).map((entry) => entry.id)).toEqual(["tpl"]);
  });
});
