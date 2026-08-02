import { describe, expect, it } from "vitest";
import { getTestDb } from "#test-db";
import { createSpace } from "./spaces.ts";
import { createPage } from "./pages.ts";
import { createBlock } from "./blocks.ts";
import { createItem } from "./items.ts";
import { loadMirror } from "./mirror.ts";

const NOW = 1_700_000_000_000;

describe("loadMirror", () => {
  it("finds an open task assigned to a person, wherever its block lives, but not done or other people's tasks", async () => {
    const db = await getTestDb();
    await createSpace(db, { id: "person", name: "Person", kind: "person", short: "PE" }, NOW);
    await createSpace(db, { id: "other-person", name: "Other", kind: "person", short: "OT" }, NOW);
    await createSpace(db, { id: "topic", name: "Topic", kind: "topic", short: "TO" }, NOW);
    const page = await createPage(db, { id: "topic-page", spaceId: "topic", title: "Notes" }, NOW);
    await createBlock(db, { id: "topic-block", pageId: page.id, templateId: null, title: "Meeting", date: "2026-08-10" }, NOW);

    await createItem(
      db,
      { id: "open-task", blockId: "topic-block", position: 1000, kind: "task", text: "assigned", dueDate: null, assigneeSpaceId: "person" },
      NOW,
    );
    await createItem(
      db,
      {
        id: "done-task",
        blockId: "topic-block",
        position: 2000,
        kind: "task",
        text: "done already",
        dueDate: null,
        assigneeSpaceId: "person",
        done: true,
      },
      NOW,
    );
    await createItem(
      db,
      { id: "other-task", blockId: "topic-block", position: 3000, kind: "task", text: "not mine", dueDate: null, assigneeSpaceId: "other-person" },
      NOW,
    );

    const mirror = await loadMirror(db, "person");

    expect(mirror).toEqual([
      {
        item: expect.objectContaining({ id: "open-task", assigneeSpaceId: "person", done: false }),
        block: { id: "topic-block", pageId: "topic-page", title: "Meeting", date: "2026-08-10" },
      },
    ]);
  });
});
