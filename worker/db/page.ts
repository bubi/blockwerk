import type { BlockRow, ItemRow } from "../../shared/db.ts";
import { orderBlockItems, orderPageBlocks } from "../../src/domain/order.ts";
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
 * The SQL here is purely mechanical (`block_id`, then `id` for stable
 * grouping). Both orderings are the domain rules, computed by
 * `orderPageBlocks` and `orderBlockItems` (src/domain/order.ts) — the only
 * places the order is defined, for the worker and the client alike.
 */
export async function loadPageBlocks(db: D1Database, pageId: string): Promise<PageBlock[]> {
  const { results: blockRows } = await db
    .prepare("SELECT * FROM blocks WHERE page_id = ?")
    .bind(pageId)
    .all<RawBlockRow>();

  if (blockRows.length === 0) return [];

  const placeholders = blockRows.map(() => "?").join(", ");
  const { results: itemRows } = await db
    .prepare(`SELECT * FROM items WHERE block_id IN (${placeholders}) ORDER BY block_id ASC, id ASC`)
    .bind(...blockRows.map((row) => row.id))
    .all<RawItemRow>();

  const itemsByBlock = new Map<string, ItemRow[]>();
  for (const raw of itemRows) {
    const item = mapItem(raw);
    const existing = itemsByBlock.get(item.blockId);
    if (existing) existing.push(item);
    else itemsByBlock.set(item.blockId, [item]);
  }

  return orderPageBlocks(blockRows.map(mapBlock)).map((block) => ({
    ...block,
    items: orderBlockItems(itemsByBlock.get(block.id) ?? []),
  }));
}
