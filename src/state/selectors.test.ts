import { describe, expect, it } from "vitest";
import { block, item, page, space, template } from "../domain/fixtures.ts";
import {
  selectCalendar,
  selectMeSpaceId,
  selectOpenTaskCounts,
  selectPageBlocks,
  selectPersonOpenCount,
  selectPersonOverview,
  selectSpaces,
  selectTeamOverview,
  selectTemplates,
} from "./selectors.ts";
import { initialState, type AppState } from "./state.ts";

const TODAY = "2026-08-10";

function withData(seed: {
  spaces?: ReturnType<typeof space>[];
  pages?: ReturnType<typeof page>[];
  blocks?: ReturnType<typeof block>[];
  items?: ReturnType<typeof item>[];
  templates?: ReturnType<typeof template>[];
  meSpaceId?: string | null;
}): AppState {
  const state = initialState();
  return {
    ...state,
    spaces: new Map((seed.spaces ?? []).map((row) => [row.id, row])),
    pages: new Map((seed.pages ?? []).map((row) => [row.id, row])),
    blocks: new Map((seed.blocks ?? []).map((row) => [row.id, row])),
    items: new Map((seed.items ?? []).map((row) => [row.id, row])),
    templates: new Map((seed.templates ?? []).map((row) => [row.id, row])),
    meSpaceId: seed.meSpaceId ?? null,
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
    expect(blocks[0]!.sections.order).toEqual(["note", "ref", "task", "event"]);
  });

  it("sorts blocks of a page by date descending, id ascending", () => {
    const state = withData({
      blocks: [block({ id: "old", pageId: "pg1", date: "2026-08-01" }), block({ id: "new", pageId: "pg1", date: "2026-08-10" })],
    });
    expect(selectPageBlocks(state, "pg1").map((entry) => entry.id)).toEqual(["new", "old"]);
  });
});

describe("selectTeamOverview / selectPersonOverview", () => {
  const spaces = () => [
    space({ id: "lena", name: "Lena Brandt", kind: "person" }),
    space({ id: "tomas", name: "Tomas Kirsch", kind: "person" }),
    space({ id: "road", name: "Roadmap", kind: "topic" }),
  ];

  it("team view sections all open tasks and scopes to mine", () => {
    const state = withData({
      spaces: spaces(),
      blocks: [block({ id: "b1", pageId: "pg1", title: "Meeting", date: "2026-08-01" })],
      pages: [page({ id: "pg1", spaceId: "road", title: "Planung" })],
      items: [
        item({ id: "mine-late", kind: "task", blockId: "b1", dueDate: "2026-08-09", assigneeSpaceId: "lena" }),
        item({ id: "other-open", kind: "task", blockId: "b1", dueDate: "2026-08-12", assigneeSpaceId: "tomas" }),
        item({ id: "done", kind: "task", blockId: "b1", dueDate: "2026-08-09", assigneeSpaceId: "lena", done: true }),
      ],
    });

    const all = selectTeamOverview(state, TODAY, "team", null, selectSpaces(state));
    expect(all.overdue.map((row) => row.item.id)).toEqual(["mine-late"]);
    expect(all.days.map((day) => day.tasks.map((row) => row.item.id))).toEqual([["other-open"]]);

    const mine = selectTeamOverview(state, TODAY, "mine", "lena", selectSpaces(state));
    expect(mine.overdue.map((row) => row.item.id)).toEqual(["mine-late"]);
    expect(mine.days).toEqual([]);
    expect(mine.workload).toEqual([
      { space: expect.objectContaining({ id: "lena" }), open: 1, late: 1 },
      { space: expect.objectContaining({ id: "tomas" }), open: 1, late: 0 },
    ]);
  });

  it("person view shows only that person's tasks, no events", () => {
    const state = withData({
      spaces: spaces(),
      blocks: [block({ id: "b1", pageId: "pg1", title: "Meeting", date: "2026-08-01" })],
      pages: [page({ id: "pg1", spaceId: "road", title: "Planung" })],
      items: [
        item({ id: "l1", kind: "task", blockId: "b1", dueDate: "2026-08-12", assigneeSpaceId: "lena" }),
        item({ id: "t1", kind: "task", blockId: "b1", dueDate: "2026-08-12", assigneeSpaceId: "tomas" }),
        item({ id: "e1", kind: "event", blockId: "b1", eventDate: "2026-08-12" }),
      ],
    });

    const view = selectPersonOverview(state, TODAY, "lena", selectSpaces(state));
    const day = view.days[0]!;
    expect(day.tasks.map((row) => row.item.id)).toEqual(["l1"]);
    expect(day.events).toEqual([]);
    expect(view.overdue).toEqual([]);
  });

  it('"nur meine" without a known identity shows nothing, never everything', () => {
    const state = withData({
      spaces: spaces(),
      blocks: [block({ id: "b1", pageId: "pg1", title: "Meeting", date: "2026-08-01" })],
      pages: [page({ id: "pg1", spaceId: "road", title: "Planung" })],
      items: [item({ id: "l1", kind: "task", blockId: "b1", dueDate: "2026-08-12", assigneeSpaceId: "lena" })],
    });

    const unknown = selectTeamOverview(state, TODAY, "mine", null, selectSpaces(state));
    expect(unknown.overdue).toEqual([]);
    expect(unknown.days).toEqual([]);

    const known = selectTeamOverview(state, TODAY, "mine", "lena", selectSpaces(state));
    expect(known.days[0]!.tasks.map((row) => row.item.id)).toEqual(["l1"]);
  });

  it("open counts derive from the normalized rows; identity resolves from state", () => {
    const state = withData({
      spaces: spaces(),
      blocks: [block({ id: "b1", pageId: "pg1", date: "2026-08-01" })],
      pages: [page({ id: "pg1", spaceId: "road", title: "Planung" })],
      items: [
        item({ id: "l1", kind: "task", blockId: "b1", assigneeSpaceId: "lena" }),
        item({ id: "l2", kind: "task", blockId: "b1", assigneeSpaceId: "lena" }),
        item({ id: "ldone", kind: "task", blockId: "b1", assigneeSpaceId: "lena", done: true }),
      ],
      meSpaceId: "lena",
    });

    expect(selectPersonOpenCount(state, "lena")).toBe(2);
    expect(selectOpenTaskCounts(state).get("lena")).toBe(2);
    expect(selectMeSpaceId(state)).toBe("lena");
  });
});

describe("selectCalendar", () => {
  it("projects the window via the domain function, without blocks", () => {
    const state = withData({
      blocks: [block({ id: "b-in", date: "2026-08-10" }), block({ id: "b-out", date: "2026-07-01" })],
      items: [
        item({ id: "t-in", kind: "task", dueDate: "2026-08-10" }),
        item({ id: "e-in", kind: "event", eventDate: "2026-08-10", eventTime: "14:00" }),
        item({ id: "note", kind: "note" }),
      ],
    });
    const window = selectCalendar(state, "2026-08-01", "2026-08-31");
    expect(Object.hasOwn(window, "blocks")).toBe(false);
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
