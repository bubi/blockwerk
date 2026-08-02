import { describe, expect, it } from "vitest";
import { getTestDb } from "#test-db";
import { createSpace } from "./spaces.ts";
import { createPage } from "./pages.ts";
import { createBlock } from "./blocks.ts";
import { createItem, getItem } from "./items.ts";
import { loadPageBlocks } from "./page.ts";
import { countingD1 } from "./testing/counting-d1.ts";

const NOW = 1_700_000_000_000;

async function makePage(db: Awaited<ReturnType<typeof getTestDb>>, prefix: string) {
  await createSpace(db, { id: `${prefix}-space`, name: prefix, kind: "topic", short: "TP" }, NOW);
  const page = await createPage(db, { id: `${prefix}-page`, spaceId: `${prefix}-space`, title: prefix }, NOW);
  return page;
}

describe("loadPageBlocks", () => {
  it("loads blocks and items with a fixed, small number of queries — 3 blocks / 6 items", async () => {
    const raw = await getTestDb();
    const page = await makePage(raw, "small");
    for (let b = 0; b < 3; b++) {
      const blockId = `small-block-${b}`;
      await createBlock(raw, { id: blockId, pageId: page.id, templateId: null, title: blockId, date: "2026-08-01" }, NOW);
      for (let i = 0; i < 2; i++) {
        await createItem(
          raw,
          { id: `${blockId}-item-${i}`, blockId, position: (i + 1) * 1000, kind: "note", text: "x", heading: null },
          NOW,
        );
      }
    }

    const { db, count } = countingD1(raw);
    const result = await loadPageBlocks(db, page.id);

    expect(result).toHaveLength(3);
    expect(result.reduce((n, block) => n + block.items.length, 0)).toBe(6);
    expect(count()).toBe(2);
  });

  it("loads blocks and items with the same fixed query count at 50 blocks / 500 items", async () => {
    const raw = await getTestDb();
    const page = await makePage(raw, "big");
    for (let b = 0; b < 50; b++) {
      const blockId = `big-block-${b}`;
      await createBlock(raw, { id: blockId, pageId: page.id, templateId: null, title: blockId, date: "2026-08-01" }, NOW);
      for (let i = 0; i < 10; i++) {
        await createItem(
          raw,
          { id: `${blockId}-item-${i}`, blockId, position: (i + 1) * 1000, kind: "note", text: "x", heading: null },
          NOW,
        );
      }
    }

    const { db, count } = countingD1(raw);
    const result = await loadPageBlocks(db, page.id);

    expect(result).toHaveLength(50);
    expect(result.reduce((n, block) => n + block.items.length, 0)).toBe(500);
    expect(count()).toBe(2);
  });

  it("breaks position ties deterministically by id, regardless of insertion order", async () => {
    const db = await getTestDb();
    const page = await makePage(db, "ties");
    await createBlock(db, { id: "ties-block", pageId: page.id, templateId: null, title: "x", date: "2026-08-01" }, NOW);
    // Inserted out of id order, all at the same position.
    await createItem(db, { id: "ties-b", blockId: "ties-block", position: 1000, kind: "note", text: "b", heading: null }, NOW);
    await createItem(db, { id: "ties-a", blockId: "ties-block", position: 1000, kind: "note", text: "a", heading: null }, NOW);
    await createItem(db, { id: "ties-c", blockId: "ties-block", position: 1000, kind: "note", text: "c", heading: null }, NOW);

    const [block] = await loadPageBlocks(db, page.id);
    expect(block?.items.map((item) => item.id)).toEqual(["ties-a", "ties-b", "ties-c"]);
  });

  it("inserting between two items never renumbers them", async () => {
    const db = await getTestDb();
    const page = await makePage(db, "gap");
    await createBlock(db, { id: "gap-block", pageId: page.id, templateId: null, title: "x", date: "2026-08-01" }, NOW);
    await createItem(db, { id: "gap-first", blockId: "gap-block", position: 1000, kind: "note", text: "first", heading: null }, NOW);
    await createItem(db, { id: "gap-last", blockId: "gap-block", position: 2000, kind: "note", text: "last", heading: null }, NOW);

    await createItem(db, { id: "gap-middle", blockId: "gap-block", position: 1500, kind: "note", text: "middle", heading: null }, NOW);

    const first = await getItem(db, "gap-first");
    const last = await getItem(db, "gap-last");
    expect(first?.position).toBe(1000);
    expect(last?.position).toBe(2000);

    const [block] = await loadPageBlocks(db, page.id);
    expect(block?.items.map((item) => item.id)).toEqual(["gap-first", "gap-middle", "gap-last"]);
  });
});
