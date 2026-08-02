import type { BlockRow, ItemRow } from "../../shared/db.ts";
import type { D1Like } from "./d1-like.ts";
import { mapBlock, mapItem, type RawBlockRow, type RawItemRow } from "./mappers.ts";

export interface PageBlock extends BlockRow {
  items: ItemRow[];
}

/**
 * Loads every block on a page plus all of their items, in exactly two
 * queries — one for the blocks, one for all their items via a single IN
 * clause — regardless of how many blocks or items exist. See the
 * query-budget test in worker/db/page.test.ts.
 *
 * Item order is decided here, not by the client (see docs/adr/0005):
 * notes and refs (position, id) → tasks (position, id) → events
 * (chronological by event_date/event_time, then position, id). Refs are
 * stream lines like notes — the prototype renders them among the note rows,
 * indented under headings — so they order by position with the notes.
 */
export async function loadPageBlocks(db: D1Like, pageId: string): Promise<PageBlock[]> {
  const { results: blockRows } = await db
    .prepare("SELECT * FROM blocks WHERE page_id = ? ORDER BY date DESC, id ASC")
    .bind(pageId)
    .all<RawBlockRow>();

  if (blockRows.length === 0) return [];

  const placeholders = blockRows.map(() => "?").join(", ");
  const { results: itemRows } = await db
    .prepare(
      `SELECT * FROM items WHERE block_id IN (${placeholders})
       ORDER BY
         block_id ASC,
         CASE WHEN kind IN ('note', 'ref') THEN 0 WHEN kind = 'task' THEN 1 ELSE 2 END ASC,
         CASE WHEN kind = 'event' THEN event_date ELSE '' END ASC,
         CASE WHEN kind = 'event' THEN event_time ELSE '' END ASC,
         position ASC,
         id ASC`,
    )
    .bind(...blockRows.map((row) => row.id))
    .all<RawItemRow>();

  const itemsByBlock = new Map<string, ItemRow[]>();
  for (const raw of itemRows) {
    const item = mapItem(raw);
    const existing = itemsByBlock.get(item.blockId);
    if (existing) existing.push(item);
    else itemsByBlock.set(item.blockId, [item]);
  }

  return blockRows.map((raw) => ({ ...mapBlock(raw), items: itemsByBlock.get(raw.id) ?? [] }));
}
