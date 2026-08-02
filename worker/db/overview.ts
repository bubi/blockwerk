import type { OverviewResponse } from "../../shared/api.ts";
import type { BlockRow, PageRow } from "../../shared/db.ts";
import { inOverviewWindow } from "../../src/domain/overview.ts";
import { mapBlock, mapItem, mapPage, type RawBlockRow, type RawItemRow, type RawPageRow } from "./mappers.ts";

/**
 * The overview load (docs/adr/0011): every open task, every event within the
 * next days, and the blocks/pages they belong to. Three fixed queries
 * regardless of how much data exists or how large the team is — the
 * per-person workload is derived in src/domain/overview.ts from the loaded
 * rows, never by a per-person query. Same load-all-and-project pattern as the
 * calendar route.
 */
export async function loadOverview(db: D1Database, today: string): Promise<OverviewResponse> {
  const { results: itemRows } = await db.prepare("SELECT * FROM items").all<RawItemRow>();
  const { results: blockRows } = await db.prepare("SELECT * FROM blocks").all<RawBlockRow>();
  const { results: pageRows } = await db.prepare("SELECT * FROM pages").all<RawPageRow>();

  const items = itemRows.map(mapItem);
  const tasks = items.filter((item) => item.kind === "task" && !item.done);
  const events = items.filter(
    (item) => item.kind === "event" && item.eventDate !== null && inOverviewWindow(item.eventDate, today),
  );

  const blockIds = new Set([...tasks, ...events].map((item) => item.blockId));
  const pageIds = new Set<string>();
  const blocks: BlockRow[] = [];
  for (const row of blockRows) {
    if (!blockIds.has(row.id)) continue;
    const block = mapBlock(row);
    pageIds.add(block.pageId);
    blocks.push(block);
  }
  const pages: PageRow[] = pageRows.filter((row) => pageIds.has(row.id)).map(mapPage);

  return { tasks, events, blocks, pages };
}
