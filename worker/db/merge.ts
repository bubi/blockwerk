import { z } from "zod";
import { idString } from "../../shared/schemas.ts";
import { mergeNotesToList } from "../../src/domain/merge.ts";
import { ConflictError, ValidationError } from "../errors.ts";
import { mapItem, type RawItemRow } from "./mappers.ts";
import { getItem } from "./items.ts";

export const mergeRequest = z
  .object({
    items: z
      .array(
        z
          .object({
            id: idString,
            updatedAt: z.number().int().nonnegative(),
            text: z.string().max(10_000).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(1000),
  })
  .strict();

/** A guarded D1 batch commits the merged text and all deletes together. */
export async function mergeItems(db: D1Database, body: unknown, now: number) {
  const { items } = mergeRequest.parse(body);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new ValidationError([{ path: "items", code: "duplicate" }]);
  const revisions = JSON.stringify(
    items.map(({ id, updatedAt }) => ({ id, updatedAt })),
  );
  const raw = await db
    .prepare(
      "SELECT * FROM items WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?))",
    )
    .bind(revisions)
    .all<RawItemRow>();
  const rows = items
    .map((item) => raw.results.find((row) => row.id === item.id))
    .filter((row): row is RawItemRow => !!row)
    .map(mapItem);
  if (
    rows.length !== items.length ||
    rows.some(
      (row, i) =>
        row.updatedAt !== items[i]!.updatedAt ||
        (items[i]!.text !== undefined && row.text !== items[i]!.text),
    )
  )
    throw new ConflictError();
  if (new Set(rows.map((row) => row.blockId)).size !== 1)
    throw new ValidationError([{ path: "items", code: "different_blocks" }]);
  const merged = mergeNotesToList(rows);
  if (!merged || merged.text.length > 10_000)
    throw new ValidationError([{ path: "items", code: "not_mergeable" }]);
  const timestamp = Math.max(now, ...rows.map((row) => row.updatedAt + 1));
  const results = await db.batch([
    db
      .prepare(
        "UPDATE items SET text = ?, list_mark = ?, updated_at = ? WHERE id = ? AND (SELECT COUNT(*) FROM items AS original JOIN json_each(?) AS expected ON original.id = json_extract(expected.value, '$.id') WHERE original.updated_at = json_extract(expected.value, '$.updatedAt') AND original.kind = 'note' AND original.heading IS NULL AND original.parent_item_id IS NULL) = ?",
      )
      .bind(
        merged.text,
        merged.listMark,
        timestamp,
        merged.keepId,
        revisions,
        items.length,
      ),
    db
      .prepare(
        "DELETE FROM items WHERE id IN (SELECT value FROM json_each(?)) AND changes() = 1 AND EXISTS (SELECT 1 FROM items WHERE id = ? AND updated_at = ? AND text = ?)",
      )
      .bind(
        JSON.stringify(merged.deleteIds),
        merged.keepId,
        timestamp,
        merged.text,
      ),
  ]);
  if (results[0]!.meta.changes !== 1) throw new ConflictError();
  return {
    row: await getItem(db, merged.keepId),
    deletedIds: merged.deleteIds,
    respaced: null,
  };
}
