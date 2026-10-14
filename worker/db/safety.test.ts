import { describe, expect, it } from "vitest";
import { getTestDb } from "./testing/get-test-db.ts";
import { createSpace, createPage, createBlock, createItem, getItem } from "./index.ts";
import { mergeItems } from "./merge.ts";
import { patchItem } from "../handlers.ts";

async function setup(prefix: string) {
  const db = await getTestDb();
  await createSpace(db, { id: `${prefix}s`, kind: "topic", name: "Safety", short: "S" }, 1);
  await createPage(db, { id: `${prefix}p`, spaceId: `${prefix}s`, title: "Notes" }, 1);
  await createBlock(db, { id: `${prefix}b`, pageId: `${prefix}p`, title: "Block", date: "2026-10-14", templateId: null }, 1);
  const first = await createItem(db, { id: `${prefix}1`, blockId: `${prefix}b`, position: 1000, kind: "note", text: "First", heading: null }, 1);
  const second = await createItem(db, { id: `${prefix}2`, blockId: `${prefix}b`, position: 2000, kind: "note", text: "Second", heading: null }, 1);
  return { db, first, second };
}

describe("durable write safety", () => {
  it("merges in one guarded transaction and preserves the first identity", async () => {
    const { db, first, second } = await setup("merge");
    const result = await mergeItems(db, { items: [first, second].map(row => ({ id: row.id, updatedAt: row.updatedAt })) }, 10);
    expect(result.row?.id).toBe(first.id); expect(result.row?.text).toContain("First"); expect(result.row?.text).toContain("Second");
    expect(await getItem(db, second.id)).toBeNull();
  });
  it("keeps all originals when one selected row has changed", async () => {
    const { db, first, second } = await setup("conflict");
    await patchItem(db, second.id, { text: "Newer" }, 10, "tester", second.updatedAt);
    await expect(mergeItems(db, { items: [first, second].map(row => ({ id: row.id, updatedAt: row.updatedAt })) }, 20)).rejects.toMatchObject({ status: 409 });
    expect((await getItem(db, first.id))?.text).toBe("First"); expect((await getItem(db, second.id))?.text).toBe("Newer");
  });
  it("rejects a stale patch instead of overwriting another user's text", async () => {
    const { db, first } = await setup("patch");
    await patchItem(db, first.id, { text: "Saved" }, 10, "first", 1);
    await expect(patchItem(db, first.id, { text: "Stale" }, 20, "second", 1)).rejects.toMatchObject({ status: 409 });
    expect((await getItem(db, first.id))?.text).toBe("Saved");
  });
});
