import { describe, expect, it } from "vitest";
import { item } from "./fixtures.ts";
import { groupMirrorTasks } from "./mirror.ts";

describe("groupMirrorTasks", () => {
  it("groups tasks by source block, preserving first-seen block order", () => {
    const groups = groupMirrorTasks([
      { item: item({ id: "t1", kind: "task", blockId: "b2" }), block: { id: "b2", pageId: "p1", title: "B", date: "2026-08-02" } },
      { item: item({ id: "t2", kind: "task", blockId: "b1" }), block: { id: "b1", pageId: "p1", title: "A", date: "2026-08-01" } },
      { item: item({ id: "t3", kind: "task", blockId: "b2" }), block: { id: "b2", pageId: "p1", title: "B", date: "2026-08-02" } },
    ]);

    expect(groups.map((group) => group.block.id)).toEqual(["b2", "b1"]);
    expect(groups[0]!.tasks.map((task) => task.id)).toEqual(["t1", "t3"]);
    expect(groups[1]!.tasks.map((task) => task.id)).toEqual(["t2"]);
  });

  it("returns an empty list for no tasks", () => {
    expect(groupMirrorTasks([])).toEqual([]);
  });
});
