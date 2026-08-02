import type { BlockRow } from "../../shared/db.ts";
import { mapBlock, type RawBlockRow } from "./mappers.ts";

export interface NewBlockInput {
  id: string;
  pageId: string;
  templateId: string | null;
  title: string;
  date: string;
}

export interface BlockPatch {
  templateId?: string | null;
  title?: string;
  date?: string;
}

export async function createBlock(db: D1Database, input: NewBlockInput, now: number): Promise<BlockRow> {
  await db
    .prepare(
      "INSERT INTO blocks (id, page_id, template_id, title, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(input.id, input.pageId, input.templateId, input.title, input.date, now, now)
    .run();
  return { ...input, createdAt: now, updatedAt: now };
}

export async function getBlock(db: D1Database, id: string): Promise<BlockRow | null> {
  const row = await db.prepare("SELECT * FROM blocks WHERE id = ?").bind(id).first<RawBlockRow>();
  return row ? mapBlock(row) : null;
}

export async function updateBlock(db: D1Database, id: string, patch: BlockPatch, now: number): Promise<BlockRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  // templateId is nullable and "set to null" (un-template a block) is a real
  // operation, so it can't use COALESCE like the non-nullable fields below.
  if (patch.templateId !== undefined) {
    sets.push("template_id = ?");
    values.push(patch.templateId);
  }
  if (patch.title !== undefined) {
    sets.push("title = ?");
    values.push(patch.title);
  }
  if (patch.date !== undefined) {
    sets.push("date = ?");
    values.push(patch.date);
  }
  sets.push("updated_at = ?");
  values.push(now, id);

  const result = await db.prepare(`UPDATE blocks SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  if (result.meta.changes === 0) return null;
  return getBlock(db, id);
}

/**
 * Cascades its items; ref items elsewhere pointing at this block keep their
 * row and lose only ref_block_id — see docs/adr/0001-task-spiegel.md.
 */
export async function deleteBlock(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM blocks WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}
