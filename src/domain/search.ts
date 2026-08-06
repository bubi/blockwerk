import type { BlockRow, ItemRow } from "../../shared/db.ts";
import { orderPageBlocks } from "./order.ts";

/** Cap per result group, so a broad query cannot dump the whole database
 * into one response. A search result list is a navigation aid, not an export. */
export const SEARCH_LIMIT = 50;

export interface SearchMatch {
  blocks: BlockRow[];
  items: ItemRow[];
}

/**
 * The single definition of what the search finds and in which order (prototype
 * reference): a block hits on its title, an item on its text, both as a
 * case-insensitive substring. Blocks come first, ordered by the page-stream
 * rule (orderPageBlocks — newest date, then newest creation, then id); items
 * follow ordered by their block's date, then stream position. Both lists are
 * capped at SEARCH_LIMIT. The worker and the client both go through this
 * function — nothing re-derives the rule in SQL.
 */
export function searchMatches(blocks: readonly BlockRow[], items: readonly ItemRow[], rawQuery: string): SearchMatch {
  const q = rawQuery.trim().toLowerCase();
  if (q === "") return { blocks: [], items: [] };

  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const hitBlocks = orderPageBlocks(
    blocks.filter((block) => block.title.toLowerCase().includes(q)),
  );
  const hitItems = items
    .filter((item) => item.text.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        (blockById.get(b.blockId)?.date ?? "").localeCompare(blockById.get(a.blockId)?.date ?? "") ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    );

  return { blocks: hitBlocks.slice(0, SEARCH_LIMIT), items: hitItems.slice(0, SEARCH_LIMIT) };
}
