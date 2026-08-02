import type { BlockRow, ItemRow } from "../../shared/db.ts";
import type { D1Like } from "./d1-like.ts";
import { mapItem, type RawItemRow } from "./mappers.ts";

export interface MirrorTask {
  item: ItemRow;
  block: Pick<BlockRow, "id" | "pageId" | "title" | "date">;
}

interface RawMirrorRow extends RawItemRow {
  block_id_: string;
  block_page_id: string;
  block_title: string;
  block_date: string;
}

/**
 * Open tasks assigned to a space, wherever their block lives — the mirror
 * from docs/adr/0001-task-spiegel.md: `SELECT … WHERE assignee_space_id = ?`,
 * joined with blocks for just enough context (title, date, page) to link
 * back to the source. One query.
 */
export async function loadMirror(db: D1Like, assigneeSpaceId: string): Promise<MirrorTask[]> {
  const { results } = await db
    .prepare(
      `SELECT
        items.*,
        blocks.id AS block_id_,
        blocks.page_id AS block_page_id,
        blocks.title AS block_title,
        blocks.date AS block_date
       FROM items
       JOIN blocks ON blocks.id = items.block_id
       WHERE items.assignee_space_id = ? AND items.kind = 'task' AND items.done = 0
       ORDER BY items.due_date IS NULL, items.due_date ASC, items.id ASC`,
    )
    .bind(assigneeSpaceId)
    .all<RawMirrorRow>();

  return results.map((row) => ({
    item: mapItem(row),
    block: { id: row.block_id_, pageId: row.block_page_id, title: row.block_title, date: row.block_date },
  }));
}
