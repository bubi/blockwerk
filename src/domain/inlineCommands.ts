import type { ItemRow } from "../../shared/db.ts";
import { canMergeNotes } from "./merge.ts";

/** Detect a newly inserted command token without treating URLs or paths as commands. */
export function insertedCommand(
  before: string,
  after: string,
): { start: number; query: string } | null {
  if (after.length <= before.length) return null;
  let start = 0;
  while (start < before.length && before[start] === after[start]) start++;
  const length = after.length - before.length;
  if (after.slice(start + length) !== before.slice(start)) return null;
  const inserted = after.slice(start, start + length);
  if (
    !/^\/[a-z]*$/i.test(inserted) ||
    (start > 0 && !/\s/.test(before[start - 1]!))
  )
    return null;
  return { start, query: inserted.slice(1) };
}

/** An explicit range wins. Without one, offer the adjacent pair without crossing a section boundary. */
export function inlineMergeItems(
  items: readonly ItemRow[],
  order: readonly string[],
  selected: ReadonlySet<string>,
  currentId: string,
): ItemRow[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const rows = (ids: readonly string[]) =>
    ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  if (selected.size > 1) return rows(order.filter((id) => selected.has(id)));
  const index = order.indexOf(currentId);
  if (index < 0) return [];
  const next = rows(order.slice(index, index + 2));
  if (canMergeNotes(next)) return next;
  const previous = rows(order.slice(Math.max(0, index - 1), index + 1));
  return canMergeNotes(previous) ? previous : rows([currentId]);
}

/** Slash is available at every caret position; URL/path separators remain literal. */
export function slashStartsCommand(text: string, caret: number): boolean {
  return !/[^\s]*[:/\\][^\s]*$/.test(text.slice(0, caret));
}
