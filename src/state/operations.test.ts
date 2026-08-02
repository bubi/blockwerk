import { describe, expect, it, vi } from "vitest";
import type { SpacesResponse } from "../../shared/api.ts";
import type { ApiClient } from "./client.ts";
import { createOperations } from "./operations.ts";
import type { Action } from "./reducer.ts";

function makeHarness() {
  const calls = {
    getSpaces: vi.fn(),
    getPage: vi.fn(),
    getMirror: vi.fn(),
    getCalendar: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  const client: ApiClient = {
    getSpaces: calls.getSpaces,
    getPage: calls.getPage,
    getMirror: calls.getMirror,
    getCalendar: calls.getCalendar,
    put: calls.put,
    patch: calls.patch,
    delete: calls.delete,
  };
  const actions: Action[] = [];
  const ops = createOperations(client, (action) => actions.push(action));
  return { client, calls, actions, ops };
}

describe("operations — optimistic writes", () => {
  it("dispatches the optimistic write before the request and confirms after", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.put.mockResolvedValue({});

    await ops.createItem({ id: "i1", blockId: "b1", kind: "note", position: 1000, text: "hi" });

    expect(actions.map((action) => action.type)).toEqual(["writeOptimistic", "writeConfirmed"]);
    expect(calls.put).toHaveBeenCalledWith("item", "i1", expect.objectContaining({ kind: "note", position: 1000, text: "hi" }));

    const optimistic = actions[0]!;
    if (optimistic.type === "writeOptimistic" && optimistic.op.change === "put") {
      expect(optimistic.op.row).toMatchObject({ id: "i1", blockId: "b1", kind: "note", text: "hi", done: false });
    }
  });

  it("dispatches a rollback with the classified error when the write fails", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.put.mockRejectedValue({ kind: "http", status: 400, body: null });

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
    calls.patch.mockResolvedValue({});
    calls.delete.mockResolvedValue(undefined);

    await ops.updateItem("i1", { done: true });
    expect(calls.patch).toHaveBeenCalledWith("item", "i1", { done: true });

    await ops.deleteSpace("s1");
    expect(calls.delete).toHaveBeenCalledWith("space", "s1");
    expect(actions.filter((action) => action.type === "writeConfirmed")).toHaveLength(2);
  });
});

describe("operations — loads", () => {
  it("loads spaces and flattens the nested pages into the action", async () => {
    const { calls, actions, ops } = makeHarness();
    const payload: SpacesResponse = {
      spaces: [{ id: "s1", name: "S", kind: "topic", short: "S", createdAt: 1, updatedAt: 1, pages: [{ id: "p1", spaceId: "s1", title: "P", createdAt: 1, updatedAt: 1 }] }],
      templates: [],
    };
    calls.getSpaces.mockResolvedValue(payload);

    await ops.loadSpaces();

    expect(actions.map((action) => action.type)).toEqual(["spacesLoadStarted", "spacesLoaded"]);
    const loaded = actions[1]!;
    if (loaded.type === "spacesLoaded") {
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

  it("loads page, mirror, and calendar", async () => {
    const { calls, actions, ops } = makeHarness();
    calls.getPage.mockResolvedValue({ page: { id: "p1", spaceId: "s1", title: "P", createdAt: 1, updatedAt: 1 }, blocks: [] });
    calls.getMirror.mockResolvedValue([]);
    calls.getCalendar.mockResolvedValue({ blocks: [], dueTasks: [], events: [] });

    await ops.loadPage("p1");
    await ops.loadMirror("person1");
    await ops.loadCalendar("2026-08-01", "2026-08-31");

    const types = actions.map((action) => action.type);
    expect(types).toEqual(["pageLoadStarted", "pageLoaded", "mirrorLoadStarted", "mirrorLoaded", "calendarLoadStarted", "calendarLoaded"]);
    expect(calls.getCalendar).toHaveBeenCalledWith("2026-08-01", "2026-08-31");
  });
});
