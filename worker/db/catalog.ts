import { mapBlock, mapPage, mapItem, type RawBlockRow, type RawPageRow, type RawItemRow } from "./mappers.ts";
export async function loadCatalog(db: D1Database) {
  const [blocks, pages, items] = await Promise.all([
    db.prepare("SELECT * FROM blocks").all<RawBlockRow>(),
    db.prepare("SELECT * FROM pages").all<RawPageRow>(),
    db.prepare("SELECT * FROM items WHERE kind = 'ref' OR (kind = 'task' AND done = 1)").all<RawItemRow>(),
  ]);
  return { blocks: blocks.results.map(mapBlock), pages: pages.results.map(mapPage), items: items.results.map(mapItem) };
}
