import { describe, expect, it } from "vitest";
import { getTestDb } from "./testing/get-test-db.ts";
import type { D1Like } from "./d1-like.ts";

const NOW = 1_700_000_000_000;
const DATE = "2026-08-01";

async function insertSpace(db: D1Like, id: string, kind: "person" | "topic" = "topic") {
  await db
    .prepare("INSERT INTO spaces (id, name, kind, short, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, id, kind, id.slice(0, 2).toUpperCase(), NOW, NOW)
    .run();
}

async function insertPage(db: D1Like, id: string, spaceId: string) {
  await db
    .prepare("INSERT INTO pages (id, space_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, spaceId, id, NOW, NOW)
    .run();
}

async function insertBlock(db: D1Like, id: string, pageId: string, templateId: string | null = null) {
  await db
    .prepare(
      "INSERT INTO blocks (id, page_id, template_id, title, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id, pageId, templateId, id, DATE, NOW, NOW)
    .run();
}

async function insertNote(db: D1Like, id: string, blockId: string, position: number) {
  await db
    .prepare(
      "INSERT INTO items (id, block_id, kind, position, text, created_at, updated_at) VALUES (?, ?, 'note', ?, ?, ?, ?)",
    )
    .bind(id, blockId, position, id, NOW, NOW)
    .run();
}

async function insertTask(db: D1Like, id: string, blockId: string, position: number, assigneeSpaceId: string) {
  await db
    .prepare(
      "INSERT INTO items (id, block_id, kind, position, text, assignee_space_id, created_at, updated_at) VALUES (?, ?, 'task', ?, ?, ?, ?, ?)",
    )
    .bind(id, blockId, position, id, assigneeSpaceId, NOW, NOW)
    .run();
}

async function insertRef(db: D1Like, id: string, blockId: string, position: number, refBlockId: string) {
  await db
    .prepare(
      "INSERT INTO items (id, block_id, kind, position, ref_block_id, created_at, updated_at) VALUES (?, ?, 'ref', ?, ?, ?, ?)",
    )
    .bind(id, blockId, position, refBlockId, NOW, NOW)
    .run();
}

async function insertTemplate(db: D1Like, id: string) {
  await db
    .prepare("INSERT INTO templates (id, label, hue, created_at, updated_at) VALUES (?, ?, 'steel', ?, ?)")
    .bind(id, id, NOW, NOW)
    .run();
}

describe("schema", () => {
  it("enforces foreign keys", async () => {
    const db = await getTestDb();
    await expect(insertPage(db, "p-orphan", "no-such-space")).rejects.toThrow();
  });

  it("cascades a space delete along the ownership chain, and only nulls assignee_space_id elsewhere", async () => {
    const db = await getTestDb();

    // Space A owns page/block/note — all of it should disappear.
    await insertSpace(db, "space-a");
    await insertPage(db, "page-a", "space-a");
    await insertBlock(db, "block-a", "page-a");
    await insertNote(db, "note-a", "block-a", 1000);

    // Space B is unrelated, but has a task assigned to space A.
    await insertSpace(db, "space-b");
    await insertPage(db, "page-b", "space-b");
    await insertBlock(db, "block-b", "page-b");
    await insertTask(db, "task-b", "block-b", 1000, "space-a");

    await db.prepare("DELETE FROM spaces WHERE id = ?").bind("space-a").run();

    expect(await db.prepare("SELECT id FROM pages WHERE id = ?").bind("page-a").first()).toBeNull();
    expect(await db.prepare("SELECT id FROM blocks WHERE id = ?").bind("block-a").first()).toBeNull();
    expect(await db.prepare("SELECT id FROM items WHERE id = ?").bind("note-a").first()).toBeNull();

    const task = await db
      .prepare("SELECT id, assignee_space_id FROM items WHERE id = ?")
      .bind("task-b")
      .first<{ id: string; assignee_space_id: string | null }>();
    expect(task).toEqual({ id: "task-b", assignee_space_id: null });
  });

  it("leaves the block and its items untouched when a template is deleted, only nulling template_id", async () => {
    const db = await getTestDb();

    await insertTemplate(db, "tpl");
    await insertSpace(db, "space-c");
    await insertPage(db, "page-c", "space-c");
    await insertBlock(db, "block-c", "page-c", "tpl");
    await insertNote(db, "note-c", "block-c", 1000);

    await db.prepare("DELETE FROM templates WHERE id = ?").bind("tpl").run();

    const block = await db
      .prepare("SELECT id, title, date, template_id FROM blocks WHERE id = ?")
      .bind("block-c")
      .first<{ id: string; title: string; date: string; template_id: string | null }>();
    expect(block).toEqual({ id: "block-c", title: "block-c", date: DATE, template_id: null });

    expect(await db.prepare("SELECT id FROM items WHERE id = ?").bind("note-c").first()).toEqual({
      id: "note-c",
    });
  });

  it("keeps a ref item when its target block is deleted, only nulling ref_block_id", async () => {
    const db = await getTestDb();

    await insertSpace(db, "space-d");
    await insertPage(db, "page-d", "space-d");
    await insertBlock(db, "block-target", "page-d");
    await insertBlock(db, "block-source", "page-d");
    await insertRef(db, "ref-1", "block-source", 1000, "block-target");

    await db.prepare("DELETE FROM blocks WHERE id = ?").bind("block-target").run();

    const ref = await db
      .prepare("SELECT id, ref_block_id FROM items WHERE id = ?")
      .bind("ref-1")
      .first<{ id: string; ref_block_id: string | null }>();
    expect(ref).toEqual({ id: "ref-1", ref_block_id: null });
  });
});
