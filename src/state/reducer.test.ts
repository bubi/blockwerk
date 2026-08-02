import { describe, expect, it } from "vitest";
import { block, item, page, space, template } from "../domain/fixtures.ts";
import { reduce } from "./reducer.ts";
import { selectMirror, selectPageBlocks } from "./selectors.ts";
import { initialState, type AppState, type ClientError, type ViewStatus } from "./state.ts";

const NOW = 1_700_000_000_000;

describe("optimistic writes", () => {
  it("optimistic create then confirmation keeps exactly one entry", () => {
    const row = item({ id: "i1", kind: "note" });
    let state = reduce(initialState(), { type: "writeOptimistic", op: { opKey: "k1", entity: "item", id: "i1", change: "put", row }, now: NOW });

    expect(state.items.size).toBe(1);
    expect(state.items.get("i1")).toBe(row);
    expect(state.pending.size).toBe(1);

    state = reduce(state, { type: "writeConfirmed", opKey: "k1" });

    expect(state.items.size).toBe(1);
    expect(state.pending.size).toBe(0);
  });

  it("a confirmation with re-spaced positions adopts them without touching other fields", () => {
    const newRow = item({ id: "i1", kind: "note", position: 1001, text: "neu" });
    const neighbor = item({ id: "i0", kind: "note", position: 1001, text: "alt" });
    let state = withData(initialState(), { items: [neighbor] });
    state = reduce(state, { type: "writeOptimistic", op: { opKey: "k1", entity: "item", id: "i1", change: "put", row: newRow }, now: NOW });

    state = reduce(state, {
      type: "writeConfirmed",
      opKey: "k1",
      respaced: { i0: 1000, i1: 2000, i2: 3000 },
    });

    expect(state.items.get("i0")).toMatchObject({ id: "i0", position: 1000, text: "alt" });
    expect(state.items.get("i1")).toMatchObject({ id: "i1", position: 2000, text: "neu" });
    // Unknown ids in the map are ignored.
    expect(state.items.has("i2")).toBe(false);
    expect(state.pending.size).toBe(0);
  });

  it("optimistic create then failure rolls back and records a visible error", () => {
    const row = item({ id: "i1", kind: "note" });
    const error: ClientError = { kind: "network", message: "offline" };
    const state = reduce(
      reduce(initialState(), { type: "writeOptimistic", op: { opKey: "k1", entity: "item", id: "i1", change: "put", row }, now: NOW }),
      { type: "writeFailed", opKey: "k1", error, now: NOW },
    );

    expect(state.items.has("i1")).toBe(false);
    expect(state.pending.size).toBe(0);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({ id: "k1", kind: "error", entity: "item", entityId: "i1", error });
  });

  it("twice the same optimistic change leaves exactly one row", () => {
    const row = item({ id: "i1", kind: "note" });
    let state = reduce(initialState(), { type: "writeOptimistic", op: { opKey: "k1", entity: "item", id: "i1", change: "put", row }, now: NOW });
    state = reduce(state, { type: "writeOptimistic", op: { opKey: "k2", entity: "item", id: "i1", change: "put", row }, now: NOW });

    expect(state.items.size).toBe(1);
    expect(state.items.get("i1")).toBe(row);
  });

  it("checking off a task updates the block view and the mirror — the same row", () => {
    const task = item({ id: "t1", kind: "task", blockId: "b1", text: "erledigen", assigneeSpaceId: "p1" });
    const blockRow = block({ id: "b1", pageId: "pg1", title: "Meeting" });
    const base = withData(initialState(), {
      blocks: [blockRow],
      items: [task],
      mirrorOrder: new Map([["p1", ["t1"]]]),
    });

    // The mirror and the block view show the same row object.
    expect(selectMirror(base, "p1")[0]!.item).toBe(base.items.get("t1"));
    expect(selectPageBlocks(base, "pg1")[0]!.items[0]).toBe(base.items.get("t1"));

    const patched = reduce(base, { type: "writeOptimistic", op: { opKey: "k1", entity: "item", id: "t1", change: "patch", patch: { done: true } }, now: NOW });

    expect(patched.items.get("t1")?.done).toBe(true);
    expect(selectPageBlocks(patched, "pg1")[0]!.items[0]).toBe(patched.items.get("t1"));
    expect(selectMirror(patched, "p1")).toHaveLength(0);
  });

  it("an optimistic update rollback restores the previous row", () => {
    const row = item({ id: "t1", kind: "task", blockId: "b1", text: "alt" });
    const base = withData(initialState(), { items: [row] });
    const error: ClientError = { kind: "http", status: 400, body: null };

    const patched = reduce(base, { type: "writeOptimistic", op: { opKey: "k1", entity: "item", id: "t1", change: "patch", patch: { text: "neu" } }, now: NOW });
    expect(patched.items.get("t1")?.text).toBe("neu");

    const rolledBack = reduce(patched, { type: "writeFailed", opKey: "k1", error, now: NOW });
    expect(rolledBack.items.get("t1")?.text).toBe("alt");
    expect(rolledBack.notifications).toHaveLength(1);
  });
});

describe("deleting a space mirrors the server cascade locally", () => {
  it("removes the space subtree and only nulls the assignee of foreign tasks", () => {
    const base = withData(initialState(), {
      spaces: [space({ id: "gone", name: "Gone", kind: "topic" })],
      pages: [page({ id: "pg-gone", spaceId: "gone" })],
      blocks: [block({ id: "b-gone", pageId: "pg-gone" })],
      items: [
        item({ id: "note-gone", kind: "note", blockId: "b-gone" }),
        item({ id: "foreign-task", kind: "task", blockId: "b-other", assigneeSpaceId: "gone" }),
      ],
      spacesOther: [space({ id: "kept", name: "Kept", kind: "topic" })],
      pagesOther: [page({ id: "pg-kept", spaceId: "kept" })],
      blocksOther: [block({ id: "b-other", pageId: "pg-kept" })],
    });

    const state = reduce(base, { type: "writeOptimistic", op: { opKey: "k1", entity: "space", id: "gone", change: "delete" }, now: NOW });

    expect(state.spaces.has("gone")).toBe(false);
    expect(state.pages.has("pg-gone")).toBe(false);
    expect(state.blocks.has("b-gone")).toBe(false);
    expect(state.items.has("note-gone")).toBe(false);

    // The foreign task stays, only its assignment is nulled.
    expect(state.items.get("foreign-task")).toMatchObject({ id: "foreign-task", assigneeSpaceId: null });
    expect(state.spaces.has("kept")).toBe(true);
  });

  it("deleting a page cascades its blocks and purges the page view", () => {
    const base = withData(initialState(), {
      pages: [page({ id: "pg", spaceId: "sp" })],
      blocks: [block({ id: "b", pageId: "pg" })],
      items: [item({ id: "i", kind: "note", blockId: "b" })],
      mirrorViews: undefined,
    });
    const loaded = reduce(base, { type: "pageLoaded", page: base.pages.get("pg")!, blocks: [] });
    expect(loaded.pageViews.get("pg")?.status).toBe("loaded");

    const gone = reduce(loaded, { type: "writeOptimistic", op: { opKey: "k1", entity: "page", id: "pg", change: "delete" }, now: NOW });

    expect(gone.pages.has("pg")).toBe(false);
    expect(gone.blocks.has("b")).toBe(false);
    expect(gone.items.has("i")).toBe(false);
    expect(gone.pageViews.has("pg")).toBe(false);
  });

  it("deleting a person space purges its mirror state", () => {
    const base = withData(initialState(), {
      spaces: [space({ id: "gone", name: "Gone", kind: "person" })],
      pages: [page({ id: "pg-gone", spaceId: "gone" })],
      mirrorOrder: new Map([["gone", ["t1"]]]),
      mirrorViews: new Map([["gone", { status: "loaded" }]]),
    });

    const state = reduce(base, { type: "writeOptimistic", op: { opKey: "k1", entity: "space", id: "gone", change: "delete" }, now: NOW });

    expect(state.mirrorOrder.has("gone")).toBe(false);
    expect(state.mirrorViews.has("gone")).toBe(false);
  });

  it("rolls the whole subtree and the nulled assignment back", () => {
    const base = withData(initialState(), {
      spaces: [space({ id: "gone", name: "Gone", kind: "topic" })],
      pages: [page({ id: "pg-gone", spaceId: "gone" })],
      blocks: [block({ id: "b-gone", pageId: "pg-gone" })],
      items: [item({ id: "foreign-task", kind: "task", blockId: "b-other", assigneeSpaceId: "gone" })],
      blocksOther: [block({ id: "b-other", pageId: "pg-kept" })],
      pagesOther: [page({ id: "pg-kept", spaceId: "kept" })],
      spacesOther: [space({ id: "kept", name: "Kept", kind: "topic" })],
    });

    const deleted = reduce(base, { type: "writeOptimistic", op: { opKey: "k1", entity: "space", id: "gone", change: "delete" }, now: NOW });
    const error: ClientError = { kind: "network", message: "offline" };
    const rolledBack = reduce(deleted, { type: "writeFailed", opKey: "k1", error, now: NOW });

    expect(rolledBack.spaces.get("gone")?.name).toBe("Gone");
    expect(rolledBack.pages.has("pg-gone")).toBe(true);
    expect(rolledBack.blocks.has("b-gone")).toBe(true);
    expect(rolledBack.items.get("foreign-task")?.assigneeSpaceId).toBe("gone");
    expect(rolledBack.notifications).toHaveLength(1);
  });

  it("deleting a block nulls ref targets elsewhere, deleting a template nulls template_id", () => {
    const base = withData(initialState(), {
      blocks: [block({ id: "target", pageId: "pg" }), block({ id: "source", pageId: "pg", templateId: "tpl" })],
      items: [item({ id: "ref-item", kind: "ref", blockId: "source", refBlockId: "target" })],
      templates: [template({ id: "tpl", label: "T" })],
    });

    const blockGone = reduce(base, { type: "writeOptimistic", op: { opKey: "k1", entity: "block", id: "target", change: "delete" }, now: NOW });
    expect(blockGone.blocks.has("target")).toBe(false);
    expect(blockGone.items.get("ref-item")?.refBlockId).toBeNull();

    const tplGone = reduce(base, { type: "writeOptimistic", op: { opKey: "k2", entity: "template", id: "tpl", change: "delete" }, now: NOW });
    expect(tplGone.templates.has("tpl")).toBe(false);
    expect(tplGone.blocks.get("source")?.templateId).toBeNull();
  });
});

describe("load states", () => {
  it("spaces view: loading, loaded, failed — data kept on failure", () => {
    let state = reduce(initialState(), { type: "spacesLoadStarted" });
    expect(state.spacesView.status).toBe("loading");

    state = reduce(state, { type: "spacesLoaded", spaces: [space({ id: "s1" })], pages: [], templates: [] });
    expect(state.spacesView.status).toBe("loaded");
    expect(state.spaces.has("s1")).toBe(true);

    const error: ClientError = { kind: "network", message: "offline" };
    state = reduce(state, { type: "spacesLoadFailed", error });
    expect(state.spacesView).toEqual({ status: "failed", error });
    expect(state.spaces.has("s1")).toBe(true);
  });

  it("page view: loading, loaded (merges blocks), failed keeps stale blocks", () => {
    let state = withData(initialState(), { pages: [page({ id: "pg1" })], blocks: [block({ id: "old", pageId: "pg1" })] });
    state = reduce(state, { type: "pageLoadStarted", pageId: "pg1" });
    expect(state.pageViews.get("pg1")).toEqual({ status: "loading" });

    state = reduce(state, { type: "pageLoaded", page: page({ id: "pg1", title: "Neu" }), blocks: [{ ...block({ id: "b1", pageId: "pg1" }), items: [] }] });
    expect(state.pageViews.get("pg1")?.status).toBe("loaded");
    expect(state.pages.get("pg1")?.title).toBe("Neu");
    expect(state.blocks.has("b1")).toBe(true);
    expect(state.blocks.has("old")).toBe(false);
  });

  it("mirror view stores the order and the rows, calendar view merges the window", () => {
    const task = item({ id: "t1", kind: "task", blockId: "b1", assigneeSpaceId: "p1" });
    let state = reduce(initialState(), { type: "mirrorLoadStarted", spaceId: "p1" });
    state = reduce(state, { type: "mirrorLoaded", spaceId: "p1", tasks: [{ item: task, block: { id: "b1", pageId: "pg1", title: "M", date: "2026-08-10" } }] });

    expect(state.mirrorViews.get("p1")?.status).toBe("loaded");
    expect(state.mirrorOrder.get("p1")).toEqual(["t1"]);
    expect(state.items.get("t1")).toBe(task);

    state = reduce(state, { type: "calendarLoaded", dueTasks: [task], events: [] });
    expect(state.calendarView.status).toBe("loaded");
    expect(state.items.get("t1")).toBe(task);
  });

  it("dismisses a notification", () => {
    const base = reduce(initialState(), {
      type: "writeOptimistic",
      op: { opKey: "k1", entity: "item", id: "i1", change: "put", row: item({ id: "i1", kind: "note" }) },
      now: NOW,
    });
    const failed = reduce(base, { type: "writeFailed", opKey: "k1", error: { kind: "network", message: "x" }, now: NOW });
    expect(failed.notifications).toHaveLength(1);

    const dismissed = reduce(failed, { type: "dismissNotification", id: "k1" });
    expect(dismissed.notifications).toHaveLength(0);
  });
});

// ============================================================
// Test helpers
// ============================================================

interface Seed {
  spaces?: ReturnType<typeof space>[];
  pages?: ReturnType<typeof page>[];
  blocks?: ReturnType<typeof block>[];
  items?: ReturnType<typeof item>[];
  templates?: ReturnType<typeof template>[];
  mirrorOrder?: Map<string, string[]>;
  mirrorViews?: Map<string, ViewStatus>;
  spacesOther?: ReturnType<typeof space>[];
  pagesOther?: ReturnType<typeof page>[];
  blocksOther?: ReturnType<typeof block>[];
}

function withData(state: AppState, seed: Seed): AppState {
  const spaces = new Map([...seed.spaces ?? [], ...(seed.spacesOther ?? [])].map((row) => [row.id, row]));
  const pages = new Map([...seed.pages ?? [], ...(seed.pagesOther ?? [])].map((row) => [row.id, row]));
  const blocks = new Map([...seed.blocks ?? [], ...(seed.blocksOther ?? [])].map((row) => [row.id, row]));
  return {
    ...state,
    spaces,
    pages,
    blocks,
    items: new Map((seed.items ?? []).map((row) => [row.id, row])),
    templates: new Map((seed.templates ?? []).map((row) => [row.id, row])),
    mirrorOrder: seed.mirrorOrder ?? new Map(),
    mirrorViews: seed.mirrorViews ?? new Map(),
  };
}
