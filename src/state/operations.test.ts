import { describe, expect, it, vi } from "vitest";
import type { SpacesResponse } from "../../shared/api.ts";
import type { ApiClient } from "./client.ts";
import { createOperations } from "./operations.ts";
import type { Action } from "./reducer.ts";

function makeHarness() {
  const calls = {
    getSpaces: vi.fn(),
    getPage: vi.fn(),
    getCalendar: vi.fn(),
    getOverview: vi.fn(),
    search: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    putItem: vi.fn(),
    patchItem: vi.fn(),
    delete: vi.fn(),
  };
  const client: ApiClient = {
    getSpaces: calls.getSpaces,
    getPage: calls.getPage,
    getCalendar: calls.getCalendar,
    getOverview: calls.getOverview,
    search: calls.search,
    put: calls.put,
    patch: calls.patch,
    putItem: calls.putItem,
    patchItem: calls.patchItem,
    delete: calls.delete,
  };
  const actions: Action[] = [];
  const ops = createOperations(client, (action) => actions.push(action));
  return { client, calls, actions, ops };
}

describe("operations — optimistic writes", () => {
  it("dispatches the optimistic write before the request and confirms after", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.putItem.mockResolvedValue({ row: {} as never, respaced: null });

    await ops.createItem({ id: "i1", blockId: "b1", kind: "note", position: 1000, text: "hi" });

    expect(actions.map((action) => action.type)).toEqual(["writeOptimistic", "writeConfirmed"]);
    expect(calls.putItem).toHaveBeenCalledWith("i1", expect.objectContaining({ kind: "note", position: 1000, text: "hi" }));

    const optimistic = actions[0]!;
    if (optimistic.type === "writeOptimistic" && optimistic.op.change === "put") {
      expect(optimistic.op.row).toMatchObject({ id: "i1", blockId: "b1", kind: "note", text: "hi", done: false });
    }
  });

  it("forwards the block's re-spaced positions with the confirmation", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.putItem.mockResolvedValue({ row: {} as never, respaced: { i1: 2000, i0: 1000 } });

    await ops.createItem({ id: "i1", blockId: "b1", kind: "note", position: 1000 });

    const confirmed = actions[1]!;
    if (confirmed.type === "writeConfirmed") {
      expect(confirmed.respaced).toEqual({ i1: 2000, i0: 1000 });
    }
  });

  it("dispatches a rollback with the classified error when the write fails", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.putItem.mockRejectedValue({ kind: "http", status: 400, body: null });

    await ops.createItem({ id: "i1", blockId: "b1", kind: "note", position: 1000 });

    expect(actions.map((action) => action.type)).toEqual(["writeOptimistic", "writeFailed"]);
    const failed = actions[1]!;
    if (failed.type === "writeFailed") {
      expect(failed.error).toEqual({ kind: "http", status: 400, body: null });
      const optimistic = actions[0]!;
      if (optimistic.type === "writeOptimistic") expect(failed.opKey).toBe(optimistic.op.opKey);
    }
  });

  it("sends patch and delete through the right client methods", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.patchItem.mockResolvedValue({ row: {} as never, respaced: null });
    calls.delete.mockResolvedValue(undefined);

    await ops.updateItem("i1", { done: true });
    expect(calls.patchItem).toHaveBeenCalledWith("i1", { done: true });

    await ops.deleteSpace("s1");
    expect(calls.delete).toHaveBeenCalledWith("space", "s1");
    expect(actions.filter((action) => action.type === "writeConfirmed")).toHaveLength(2);
  });
});

describe("operations — loads", () => {
  it("loads spaces and flattens the nested pages into the action", async () => {
    const { calls, actions, ops } = makeHarness();
    const payload: SpacesResponse = {
      spaces: [{ id: "s1", name: "S", kind: "topic", short: "S", email: null, createdAt: 1, updatedAt: 1, pages: [{ id: "p1", spaceId: "s1", title: "P", createdAt: 1, updatedAt: 1 }] }],
      templates: [],
      meSpaceId: null,
    };
    calls.getSpaces.mockResolvedValue(payload);

    await ops.loadSpaces();

    expect(actions.map((action) => action.type)).toEqual(["spacesLoadStarted", "spacesLoaded"]);
    const loaded = actions[1]!;
    if (loaded.type === "spacesLoaded") {
      expect(loaded.meSpaceId).toBeNull();
      expect(loaded.spaces).toEqual([payload.spaces[0]]);
      expect(loaded.pages).toEqual([{ id: "p1", spaceId: "s1", title: "P", createdAt: 1, updatedAt: 1 }]);
    }
  });

  it("records a load failure in the view status action", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.getSpaces.mockRejectedValue({ kind: "network", message: "down" });

    await ops.loadSpaces();

    expect(actions.map((action) => action.type)).toEqual(["spacesLoadStarted", "spacesLoadFailed"]);
    const failed = actions[1]!;
    if (failed.type === "spacesLoadFailed") expect(failed.error).toEqual({ kind: "network", message: "down" });
  });

  it("loads page, overview, and calendar", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.getPage.mockResolvedValue({ page: { id: "p1", spaceId: "s1", title: "P", createdAt: 1, updatedAt: 1 }, blocks: [] });
    calls.getOverview.mockResolvedValue({ tasks: [], events: [], blocks: [], pages: [] });
    calls.getCalendar.mockResolvedValue({ dueTasks: [], events: [] });

    await ops.loadPage("p1");
    await ops.loadOverview("2026-08-10");
    await ops.loadCalendar("2026-08-01", "2026-08-31");

    const types = actions.map((action) => action.type);
    expect(types).toEqual(["pageLoadStarted", "pageLoaded", "overviewLoadStarted", "overviewLoaded", "calendarLoadStarted", "calendarLoaded"]);
    expect(calls.getOverview).toHaveBeenCalledWith("2026-08-10");
    expect(calls.getCalendar).toHaveBeenCalledWith("2026-08-01", "2026-08-31");
  });
});

describe("operations — search", () => {
  it("searches with the trimmed query and reports the response", async () => {
    const { calls, actions, ops } = makeHarness();
    const payload = { query: "plan", blocks: [], items: [] };
    calls.search.mockResolvedValue(payload);

    await ops.search("  plan  ");

    expect(calls.search).toHaveBeenCalledWith("plan");
    expect(actions.map((action) => action.type)).toEqual(["searchLoadStarted", "searchLoaded"]);
    const loaded = actions[1]!;
    if (loaded.type === "searchLoaded") expect(loaded.response).toEqual(payload);
  });

  it("resets the view for a blank query without a request", async () => {
    const { calls, actions, ops } = makeHarness();

    await ops.search("   ");

    expect(calls.search).not.toHaveBeenCalled();
    expect(actions.map((action) => action.type)).toEqual(["searchCleared"]);
  });

  it("classifies a failed search as a load failure", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.search.mockRejectedValue({ kind: "http", status: 500, body: null });

    await ops.search("plan");

    expect(actions.map((action) => action.type)).toEqual(["searchLoadStarted", "searchLoadFailed"]);
    const failed = actions[1]!;
    if (failed.type === "searchLoadFailed") expect(failed.error).toEqual({ kind: "http", status: 500, body: null });
  });

  it("drops a stale response when a newer query is in flight", async () => {
    const { calls, actions, ops } = makeHarness();
    let resolveOld: (value: never) => void = () => {};
    calls.search.mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)));
    calls.search.mockResolvedValue({ query: "neuer", blocks: [], items: [] });

    const old = ops.search("alter");
    const next = ops.search("neuer");
    await next;
    resolveOld({ query: "alter", blocks: [], items: [] } as never);
    await old;

    expect(calls.search).toHaveBeenNthCalledWith(1, "alter");
    expect(calls.search).toHaveBeenNthCalledWith(2, "neuer");
    // The old response must not overwrite the view — only one searchLoaded.
    expect(actions.filter((action) => action.type === "searchLoaded")).toHaveLength(1);
  });

  it("clearSearch discards an in-flight response", async () => {
    const { calls, actions, ops } = makeHarness();
    let resolveOld: (value: never) => void = () => {};
    calls.search.mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)));

    const pending = ops.search("alter");
    ops.clearSearch();
    resolveOld({ query: "alter", blocks: [], items: [] } as never);
    await pending;

    expect(actions.map((action) => action.type)).toEqual(["searchLoadStarted", "searchCleared"]);
  });
});
