import type { ItemRow } from "../../shared/db.ts";
import { listDisplayMark, type ListMark } from "./headings.ts";

export interface MergeNotesResult {
  /** The first selected row keeps its identity and position. */
  keepId: string;
  listMark: ListMark;
  /** The combined lines, each carrying the list display marker. */
  text: string;
  /** The rows after the first — to be deleted. */
  deleteIds: string[];
}

/**
 * Whether the rows can be merged into one list point: at least two rows, all
 * of them plain top-level notes. Tasks, events, refs, headings and a task's
 * own notes (they render indented under their task, docs/adr/0014) lock the
 * action — the block's group order would become ambiguous (PROJECT.md).
 */
export function canMergeNotes(items: readonly ItemRow[]): boolean {
  return (
    items.length >= 2 &&
    items.every(
      (item) =>
        item.kind === "note" &&
        item.heading === null &&
        item.parentItemId === null,
    )
  );
}

/**
 * Merges plain notes (display order) into a single list-point row: the first
 * item keeps id, block and position, its text becomes the combined lines with
 * the display marker per line; the rest are returned for deletion. Returns
 * null when the rows are not mergeable — call `canMergeNotes` for the reason.
 */
export function mergeNotesToList(
  items: readonly ItemRow[],
): MergeNotesResult | null {
  if (!canMergeNotes(items)) return null;
  const mark: ListMark = items[0]!.listMark ?? "*";
  const display = listDisplayMark(mark);
  const lines: string[] = [];
  for (const item of items) {
    for (const line of item.text.split("\n")) {
      if (line.trim() === "") continue;
      lines.push(markLine(line, display));
    }
  }
  return {
    keepId: items[0]!.id,
    listMark: mark,
    text: lines.join("\n"),
    deleteIds: items.slice(1).map((item) => item.id),
  };
}

/** Prepends the display marker, without double-marking an existing list line. */
function markLine(line: string, display: string): string {
  if (line.startsWith(display)) return line;
  for (const existing of ["• ", "- "]) {
    if (line.startsWith(existing)) return display + line.slice(existing.length);
  }
  return display + line;
}
