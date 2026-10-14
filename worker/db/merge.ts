import { z } from "zod";
import { idString } from "../../shared/schemas.ts";
import { mergeNotesToList } from "../../src/domain/merge.ts";
import { ConflictError, ValidationError } from "../errors.ts";
import { mapItem, type RawItemRow } from "./mappers.ts";
import { getItem } from "./items.ts";

export const mergeRequest = z.object({
  items: z.array(z.object({ id: idString, updatedAt: z.number().int().nonnegative() }).strict()).min(2).max(100),
}).strict();

/** A guarded D1 batch commits the merged text and all deletes together. */
export async function mergeItems(db: D1Database, body: unknown, now: number) {
  const { items } = mergeRequest.parse(body);
  if (new Set(items.map(item => item.id)).size !== items.length)
    throw new ValidationError([{ path: "items", code: "duplicate" }]);
  const marks = items.map(() => "?").join(",");
  const raw = await db.prepare(`SELECT * FROM items WHERE id IN (${marks})`).bind(...items.map(item => item.id)).all<RawItemRow>();
  const rows = items.map(item => raw.results.find(row => row.id === item.id)).filter((row): row is RawItemRow => !!row).map(mapItem);
  if (rows.length !== items.length || rows.some((row, i) => row.updatedAt !== items[i]!.updatedAt)) throw new ConflictError();
  if (new Set(rows.map(row => row.blockId)).size !== 1)
    throw new ValidationError([{ path: "items", code: "different_blocks" }]);
  const merged = mergeNotesToList(rows);
  if (!merged || merged.text.length > 10_000)
    throw new ValidationError([{ path: "items", code: "not_mergeable" }]);
  const timestamp = Math.max(now, ...rows.map(row => row.updatedAt + 1));
  const guard = items.map(() => "(id = ? AND updated_at = ? AND kind = 'note' AND heading IS NULL AND parent_item_id IS NULL)").join(" OR ");
  const guardValues = items.flatMap(item => [item.id, item.updatedAt]);
  const results = await db.batch([
    db.prepare(`UPDATE items SET text = ?, list_mark = ?, updated_at = ? WHERE id = ? AND (SELECT COUNT(*) FROM items WHERE ${guard}) = ?`)
      .bind(merged.text, merged.listMark, timestamp, merged.keepId, ...guardValues, items.length),
    db.prepare(`DELETE FROM items WHERE id IN (${merged.deleteIds.map(() => "?").join(",")}) AND changes() = 1 AND EXISTS (SELECT 1 FROM items WHERE id = ? AND updated_at = ? AND text = ?)`)
      .bind(...merged.deleteIds, merged.keepId, timestamp, merged.text),
  ]);
  if (results[0]!.meta.changes !== 1) throw new ConflictError();
  return { row: await getItem(db, merged.keepId), deletedIds: merged.deleteIds, respaced: null };
}
