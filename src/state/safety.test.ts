import { describe, expect, it } from "vitest";
import { block, item, page } from "../domain/fixtures.ts";
import { initialState } from "./state.ts";
import { reduce, type Action } from "./reducer.ts";

const edit = (opKey: string, text: string): Action => ({ type: "writeOptimistic", op: { opKey, entity: "item", id: "i", change: "patch", patch: { text } }, now: 1 });
const fail = (opKey: string): Action => ({ type: "writeFailed", opKey, error: { kind: "network", message: "offline" }, now: 2 });

describe("write and reload safety", () => {
  it("does not roll a newer confirmed edit back after a late failure", () => {
    let state = initialState(); state.items.set("i", item({ id: "i", kind: "note", text: "original" }));
    state = reduce(state, edit("old", "A")); state = reduce(state, edit("new", "AB"));
    state = reduce(state, { type: "writeConfirmed", opKey: "new" }); state = reduce(state, fail("old"));
    expect(state.items.get("i")?.text).toBe("AB");
  });
  it("keeps the latest text as a visible unsaved draft after failures", () => {
    let state = initialState(); state.items.set("i", item({ id: "i", kind: "note", text: "original" }));
    state = reduce(state, edit("old", "A")); state = reduce(state, edit("new", "AB"));
    state = reduce(state, fail("old")); state = reduce(state, fail("new"));
    expect(state.items.get("i")?.text).toBe("AB");
  });
  it("removes remotely deleted items when their block still exists", () => {
    const state = initialState(); state.items.set("i", item({ id: "i", kind: "note", blockId: "b" }));
    state.blocks.set("b", block({ id: "b", pageId: "p" }));
    const next = reduce(state, { type: "pageLoaded", page: page({ id: "p" }), blocks: [{ ...block({ id: "b", pageId: "p" }), items: [] }] });
    expect(next.items.has("i")).toBe(false);
  });
  it("keeps a pending edit over a page refresh", () => {
    let state = initialState(); const row = item({ id: "i", kind: "note", blockId: "b", text: "original" }); state.items.set("i", row);
    state = reduce(state, edit("edit", "draft"));
    state = reduce(state, { type: "pageLoaded", page: page({ id: "p" }), blocks: [{ ...block({ id: "b", pageId: "p" }), items: [row] }] });
    expect(state.items.get("i")?.text).toBe("draft");
  });
});
