import type { SearchResponse } from "../../shared/api.ts";
import type { BlockRow } from "../../shared/db.ts";
import { searchMatches } from "../../src/domain/search.ts";
import { mapBlock, mapItem, mapPage, mapSpace, mapTemplate, type RawBlockRow, type RawItemRow, type RawPageRow, type RawSpaceRow, type RawTemplateRow } from "./mappers.ts";

/**
 * Loads every block and item and hands them to the domain search
 * (src/domain/search.ts) — the single definition of what matches and in which
 * order, the same pattern as loadCalendarWindow. The context a result row
 * shows (page, space, template label) is assembled here from the raw rows.
 * The query count is fixed (5) regardless of how much data exists.
 */
export async function loadSearch(db: D1Database, query: string): Promise<SearchResponse> {
  const blocks = (await db.prepare("SELECT * FROM blocks").all<RawBlockRow>()).results.map(mapBlock);
  const items = (await db.prepare("SELECT * FROM items").all<RawItemRow>()).results.map(mapItem);
  const pages = new Map((await db.prepare("SELECT * FROM pages").all<RawPageRow>()).results.map((row) => [row.id, mapPage(row)]));
  const spaces = new Map((await db.prepare("SELECT * FROM spaces").all<RawSpaceRow>()).results.map((row) => [row.id, mapSpace(row)]));
  const templates = new Map(
    (await db.prepare("SELECT * FROM templates").all<RawTemplateRow>()).results.map((row) => [row.id, mapTemplate(row)]),
  );

  const { blocks: hitBlocks, items: hitItems } = searchMatches(blocks, items, query);

  return {
    query,
    blocks: hitBlocks.map((block) => {
      const page = pages.get(block.pageId);
      const space = page ? spaces.get(page.spaceId) : null;
      const template = block.templateId !== null ? templates.get(block.templateId) : null;
      return {
        block: { id: block.id, title: block.title, date: block.date },
        templateLabel: template?.label ?? null,
        page: { id: page?.id ?? "", title: page?.title ?? "" },
        space: { id: space?.id ?? "", name: space?.name ?? "" },
      };
    }),
    items: hitItems.map((item) => {
      const block = blockOf(item.blockId, blocks);
      const page = block ? pages.get(block.pageId) : null;
      const space = page ? spaces.get(page.spaceId) : null;
      return {
        item: { id: item.id, kind: item.kind, text: item.text },
        block: { id: block?.id ?? item.blockId, title: block?.title ?? "" },
        page: { id: page?.id ?? "", title: page?.title ?? "" },
        space: { id: space?.id ?? "", name: space?.name ?? "" },
      };
    }),
  };
}

function blockOf(id: string, blocks: BlockRow[]): BlockRow | null {
  return blocks.find((block) => block.id === id) ?? null;
}
