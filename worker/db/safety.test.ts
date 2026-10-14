import { describe, expect, it } from "vitest";
import { getTestDb } from "./testing/get-test-db.ts";
import {
  createSpace,
  createPage,
  createBlock,
  createItem,
  getItem,
} from "./index.ts";
import { mergeItems } from "./merge.ts";
import { patchItem } from "../handlers.ts";

async function setup(prefix: string) {
  const db = await getTestDb();
  await createSpace(
    db,
    { id: `${prefix}s`, kind: "topic", name: "Safety", short: "S" },
    1,
  );
  await createPage(
    db,
    { id: `${prefix}p`, spaceId: `${prefix}s`, title: "Notes" },
    1,
  );
  await createBlock(
    db,
    {
      id: `${prefix}b`,
      pageId: `${prefix}p`,
      title: "Block",
      date: "2026-10-14",
      templateId: null,
    },
    1,
  );
  const first = await createItem(
    db,
    {
      id: `${prefix}1`,
      blockId: `${prefix}b`,
      position: 1000,
      kind: "note",
      text: "First",
      heading: null,
    },
    1,
  );
  const second = await createItem(
    db,
    {
      id: `${prefix}2`,
      blockId: `${prefix}b`,
      position: 2000,
      kind: "note",
      text: "Second",
      heading: null,
    },
    1,
  );
  return { db, first, second };
}

describe("durable write safety", () => {
  it("merges in one guarded transaction and preserves the first identity", async () => {
    const { db, first, second } = await setup("merge");
    const result = await mergeItems(
      db,
      {
        items: [first, second].map((row) => ({
          id: row.id,
          updatedAt: row.updatedAt,
        })),
      },
      10,
    );
    expect(result.row?.id).toBe(first.id);
    expect(result.row?.text).toContain("First");
    expect(result.row?.text).toContain("Second");
    expect(await getItem(db, second.id)).toBeNull();
  });
  it("keeps all originals when one selected row has changed", async () => {
    const { db, first, second } = await setup("conflict");
    await patchItem(
      db,
      second.id,
      { text: "Newer" },
      10,
      "tester",
      second.updatedAt,
    );
    await expect(
      mergeItems(
        db,
        {
          items: [first, second].map((row) => ({
            id: row.id,
            updatedAt: row.updatedAt,
          })),
        },
        20,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getItem(db, first.id))?.text).toBe("First");
    expect((await getItem(db, second.id))?.text).toBe("Newer");
  });
  it("rejects a stale patch instead of overwriting another user's text", async () => {
    const { db, first } = await setup("patch");
    await patchItem(db, first.id, { text: "Saved" }, 10, "first", 1);
    await expect(
      patchItem(db, first.id, { text: "Stale" }, 20, "second", 1),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getItem(db, first.id))?.text).toBe("Saved");
  });
});

import { restoreItems, convertItem } from "../item-actions.ts";
import { deleteItem } from "./items.ts";

describe("targeted undo and conversion", () => {
  it("restores deleted content with the same ID and creation timestamp", async () => {
    const { db, first } = await setup("undo");
    await deleteItem(db, first.id);
    const { id, createdAt, updatedAt, ...data } = first;
    const restored = await restoreItems(
      db,
      { items: [{ id, createdAt, updatedAt, data }] },
      20,
    );
    expect(restored.rows[0]?.id).toBe(id);
    expect(restored.rows[0]?.createdAt).toBe(createdAt);
    expect((await getItem(db, id))?.text).toBe(first.text);
  });
  it("converts the same identity and reverses the conversion without overwriting later work", async () => {
    const { db, first } = await setup("convert");
    const converted = await convertItem(
      db,
      first.id,
      { kind: "task", updatedAt: first.updatedAt },
      10,
    );
    expect(converted.row?.id).toBe(first.id);
    expect(converted.row?.text).toBe(first.text);
    const { id, createdAt, updatedAt, ...data } = first;
    await restoreItems(
      db,
      {
        items: [{ id, createdAt, updatedAt, data }],
        expectedUpdatedAt: converted.row!.updatedAt,
      },
      20,
    );
    expect((await getItem(db, id))?.kind).toBe("note");
    await expect(
      restoreItems(
        db,
        {
          items: [{ id, createdAt, updatedAt, data }],
          expectedUpdatedAt: converted.row!.updatedAt,
        },
        30,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

it("restores a large task and all child notes atomically within a bounded query count", async () => {
  const { db, first } = await setup("bulkundo");
  const task = await convertItem(
    db,
    first.id,
    { kind: "task", updatedAt: first.updatedAt },
    10,
  );
  const children = [];
  for (let index = 0; index < 110; index++)
    children.push(
      await createItem(
        db,
        {
          id: `bulkchild${index}`,
          kind: "note",
          blockId: first.blockId,
          position: (index + 3) * 1000,
          text: `Child ${index}`,
          heading: null,
          parentItemId: first.id,
        },
        10,
      ),
    );
  await deleteItem(db, first.id);
  const restored = await restoreItems(
    db,
    {
      items: [task.row!, ...children].map(
        ({ id, createdAt, updatedAt, ...data }) => ({
          id,
          createdAt,
          updatedAt,
          data,
        }),
      ),
    },
    20,
  );
  expect(restored.rows).toHaveLength(111);
  expect((await getItem(db, children[109]!.id))?.parentItemId).toBe(first.id);
});

import { deleteEntity, moveItemHandler, putItem } from "../handlers.ts";
it("rejects stale deletion and movement without changing newer notes", async () => {
  const { db, first } = await setup("guarded");
  await patchItem(
    db,
    first.id,
    { text: "Newer" },
    10,
    "writer",
    first.updatedAt,
  );
  await expect(
    deleteEntity(db, "item", first.id, "reader", first.updatedAt),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    moveItemHandler(
      db,
      first.id,
      { blockId: first.blockId, position: 3000 },
      20,
      "reader",
      first.updatedAt,
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect((await getItem(db, first.id))?.text).toBe("Newer");
});
it("appends moved themes in durable order even when the client positions are stale", async () => {
  const { db, first, second } = await setup("append");
  await createBlock(
    db,
    {
      id: "appendtarget",
      pageId: "appendp",
      title: "Meeting",
      date: "2026-10-14",
      templateId: null,
    },
    1,
  );
  const one = await moveItemHandler(
    db,
    first.id,
    { blockId: "appendtarget", position: 1000, append: true },
    10,
    "writer",
    first.updatedAt,
  );
  const two = await moveItemHandler(
    db,
    second.id,
    { blockId: "appendtarget", position: 1000, append: true },
    10,
    "writer",
    second.updatedAt,
  );
  expect(two.row.position).toBeGreaterThan(one.row.position);
});
it("a retried creation acknowledges unchanged content and never overwrites a later edit", async () => {
  const { db, first } = await setup("retrycreate");
  const id = first.id;
  const data = {
    blockId: first.blockId,
    kind: first.kind,
    position: first.position,
    text: first.text,
    heading: first.heading,
  };
  const unchanged = await putItem(db, id, data, 10, "writer", true);
  expect(unchanged.row.updatedAt).toBe(first.updatedAt);
  await patchItem(db, id, { text: "Newer" }, 20, "writer", first.updatedAt);
  await expect(putItem(db, id, data, 30, "writer", true)).rejects.toMatchObject(
    { status: 409 },
  );
  expect((await getItem(db, id))?.text).toBe("Newer");
});
